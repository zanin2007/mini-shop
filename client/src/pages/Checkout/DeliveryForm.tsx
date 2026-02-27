interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
}

interface DeliveryInfo {
  receiver_name: string;
  receiver_phone: string;
  delivery_address: string;
  delivery_address_detail: string;
}

interface Props {
  delivery: DeliveryInfo;
  setDelivery: React.Dispatch<React.SetStateAction<DeliveryInfo>>;
}

function DeliveryForm({ delivery, setDelivery }: Props) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
    setDelivery({ ...delivery, receiver_phone: value });
  };

  const handleAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        const address = data.roadAddress || data.jibunAddress;
        setDelivery(prev => ({ ...prev, delivery_address: `(${data.zonecode}) ${address}` }));
      },
    }).open();
  };

  return (
    <div className="delivery-form">
      <div className="delivery-field">
        <label>수령인</label>
        <input
          type="text"
          placeholder="이름을 입력하세요"
          value={delivery.receiver_name}
          onChange={(e) => setDelivery({ ...delivery, receiver_name: e.target.value })}
        />
      </div>
      <div className="delivery-field">
        <label>연락처</label>
        <input
          type="tel"
          placeholder="01012345678"
          value={delivery.receiver_phone}
          onChange={handlePhoneChange}
          maxLength={11}
          inputMode="numeric"
        />
        <span className="field-hint">숫자만 입력 (- 없이)</span>
      </div>
      <div className="delivery-field">
        <label>배송 주소</label>
        <div className="address-search-row">
          <input
            type="text"
            placeholder="주소 검색을 눌러주세요"
            value={delivery.delivery_address}
            readOnly
          />
          <button type="button" className="address-search-btn" onClick={handleAddressSearch}>
            주소 검색
          </button>
        </div>
      </div>
      <div className="delivery-field">
        <label>상세 주소</label>
        <input
          type="text"
          placeholder="동/호수 등 상세주소를 입력하세요"
          value={delivery.delivery_address_detail}
          onChange={(e) => setDelivery({ ...delivery, delivery_address_detail: e.target.value })}
        />
      </div>
    </div>
  );
}

export default DeliveryForm;
