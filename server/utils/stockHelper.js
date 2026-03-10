/**
 * 주문 재고 복원 헬퍼
 * - 환불 승인(adminController.processRefund), 선물 거절(giftController.rejectGift) 공용
 * - product_id / option_value_id별 수량 집계 후 배치 CASE UPDATE
 */

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

module.exports = { restoreOrderStock };
