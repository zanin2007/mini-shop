/**
 * 재고 검증/차감/복원 헬퍼
 * - checkItemsStock: 상품 재고 검증 (cartController, orderController 공용)
 * - checkOptionsStock: 옵션 재고 검증 (cartController, orderController 공용)
 * - deductOrderStock: 주문 재고 차감 (orderController.createOrder)
 * - restoreOrderStock: 주문 재고 복원 (adminController.processRefund, giftController.rejectGift)
 */

/**
 * 상품 재고 충분 여부 검증
 * @param {Array<{stock: number, quantity: number, name?: string}>} items
 * @returns {string|null} 첫 번째 재고 부족 상품의 에러 메시지, 또는 null (모두 충분)
 */
function checkItemsStock(items) {
  for (const item of items) {
    if (item.stock < item.quantity) {
      return item.name
        ? `'${item.name}' 상품의 재고가 부족합니다. (재고: ${item.stock}개, 요청: ${item.quantity}개)`
        : `상품 재고가 부족합니다. (재고: ${item.stock}개)`;
    }
  }
  return null;
}

/**
 * 옵션 재고 충분 여부 검증
 * @param {Array<{stock: number, quantity: number, optionName?: string, optionValue?: string, productName?: string}>} options
 * @returns {string|null} 첫 번째 재고 부족 옵션의 에러 메시지, 또는 null (모두 충분)
 */
function checkOptionsStock(options) {
  for (const opt of options) {
    if (opt.stock != null && opt.stock < opt.quantity) {
      return opt.productName
        ? `'${opt.productName}' 상품의 옵션(${opt.optionName}: ${opt.optionValue}) 재고가 부족합니다. (재고: ${opt.stock}개)`
        : `옵션 재고가 부족합니다. (재고: ${opt.stock}개)`;
    }
  }
  return null;
}

/**
 * 주문 재고 차감 (상품 + 옵션) — atomic UPDATE with WHERE stock >= ?
 * 반드시 트랜잭션 connection 안에서 호출해야 한다.
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {Array<{product_id: number, quantity: number, name: string}>} cartItems
 * @param {Map<number, number[]>} optValuesByCart - cart_item_id → [option_value_id, ...]
 * @returns {Promise<string|null>} 실패 시 에러 메시지, 성공 시 null
 */
async function deductOrderStock(connection, cartItems, optValuesByCart) {
  // 상품 재고 차감
  for (const item of cartItems) {
    const [result] = await connection.execute(
      'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [item.quantity, item.product_id, item.quantity]
    );
    if (result.affectedRows === 0) {
      return `'${item.name}' 상품의 재고가 부족합니다.`;
    }
  }
  // 옵션 재고 차감
  for (const item of cartItems) {
    const ovIds = optValuesByCart.get(item.id) || [];
    for (const ovId of ovIds) {
      const [optResult] = await connection.execute(
        'UPDATE product_option_values SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, ovId, item.quantity]
      );
      if (optResult.affectedRows === 0) {
        return `'${item.name}' 상품의 옵션 재고가 부족합니다.`;
      }
    }
  }
  return null;
}

/**
 * 주문에 포함된 상품/옵션 재고를 복원한다.
 * 반드시 트랜잭션 connection 안에서 호출해야 한다.
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {number} orderId
 */
async function restoreOrderStock(connection, orderId) {
  // 상품 재고 복원 — product_id별 수량 집계 후 배치 UPDATE
  const [orderItems] = await connection.execute(
    'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
    [orderId]
  );
  if (orderItems.length > 0) {
    const stockMap = new Map();
    for (const item of orderItems) {
      stockMap.set(item.product_id, (stockMap.get(item.product_id) || 0) + item.quantity);
    }
    const aggregated = [...stockMap.entries()].map(([pid, qty]) => ({ product_id: pid, quantity: qty }));
    const caseParts = aggregated.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
    const caseVals = aggregated.flatMap(a => [a.product_id, a.quantity]);
    const idPh = aggregated.map(() => '?').join(',');
    const idVals = aggregated.map(a => a.product_id);
    await connection.execute(
      `UPDATE products SET stock = CASE ${caseParts} ELSE stock END WHERE id IN (${idPh})`,
      [...caseVals, ...idVals]
    );
  }

  // 옵션 재고 복원 — option_value_id별 수량 집계 후 배치 UPDATE
  const [optionItems] = await connection.execute(
    `SELECT oio.option_value_id, oi.quantity FROM order_item_options oio
     JOIN order_items oi ON oio.order_item_id = oi.id WHERE oi.order_id = ?`,
    [orderId]
  );
  if (optionItems.length > 0) {
    const optStockMap = new Map();
    for (const opt of optionItems) {
      optStockMap.set(opt.option_value_id, (optStockMap.get(opt.option_value_id) || 0) + opt.quantity);
    }
    const optAggregated = [...optStockMap.entries()].map(([vid, qty]) => ({ option_value_id: vid, quantity: qty }));
    const optCaseParts = optAggregated.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
    const optCaseVals = optAggregated.flatMap(a => [a.option_value_id, a.quantity]);
    const optIdPh = optAggregated.map(() => '?').join(',');
    const optIdVals = optAggregated.map(a => a.option_value_id);
    await connection.execute(
      `UPDATE product_option_values SET stock = CASE ${optCaseParts} ELSE stock END WHERE id IN (${optIdPh})`,
      [...optCaseVals, ...optIdVals]
    );
  }
}

module.exports = { checkItemsStock, checkOptionsStock, deductOrderStock, restoreOrderStock };
