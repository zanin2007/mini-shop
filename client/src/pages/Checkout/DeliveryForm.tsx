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
  const formatPhone = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
    setDelivery({ ...delivery, receiver_phone: formatPhone(digits) });
  };

  const handleAddressSearch = () => {
    if (!window.daum?.Postcode) {
      console.warn('주소 검색 서비스를 불러올 수 없습니다.');
      return;
    }
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
        <label htmlFor="delivery-receiver">수령인</label>
        <input
          id="delivery-receiver"
          type="text"
          placeholder="이름을 입력하세요"
          value={delivery.receiver_name}
          onChange={(e) => setDelivery({ ...delivery, receiver_name: e.target.value })}
        />
      </div>
      <div className="delivery-field">
        <label htmlFor="delivery-phone">연락처</label>
        <input
          id="delivery-phone"
          type="tel"
          placeholder="010-1234-5678"
          value={delivery.receiver_phone}
          onChange={handlePhoneChange}
          maxLength={13}
          inputMode="numeric"
        />
      </div>
      <div className="delivery-field">
        <label htmlFor="delivery-address">배송 주소</label>
        <div className="address-search-row">
          <input
            id="delivery-address"
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
        <label htmlFor="delivery-address-detail">상세 주소</label>
        <input
          id="delivery-address-detail"
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
