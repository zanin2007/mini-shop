import { useState } from 'react';
import api from '../../api/instance';

interface SearchedUser {
  id: number;
  nickname: string;
  email: string;
}

interface Props {
  isGift: boolean;
  setIsGift: (v: boolean) => void;
  giftMessage: string;
  setGiftMessage: (v: string) => void;
  selectedReceiver: SearchedUser | null;
  setSelectedReceiver: (v: SearchedUser | null) => void;
}

function GiftSection({ isGift, setIsGift, giftMessage, setGiftMessage, selectedReceiver, setSelectedReceiver }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchUser = (query: string) => {
    setSearchQuery(query);
    setSelectedReceiver(null);
    if (searchTimer) clearTimeout(searchTimer);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/auth/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error('유저 검색 실패:', error);
      }
    }, 300);
    setSearchTimer(timer);
  };

  const handleSelectReceiver = (user: SearchedUser) => {
    setSelectedReceiver(user);
    setSearchQuery(user.nickname);
    setSearchResults([]);
  };

  return (
    <>
      <div className="gift-toggle">
        <label>
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => {
              setIsGift(e.target.checked);
              if (!e.target.checked) {
                setSelectedReceiver(null);
                setSearchQuery('');
                setGiftMessage('');
              }
            }}
          />
          <span>선물하기</span>
        </label>
      </div>
      {isGift && (
        <div className="gift-form">
          <div className="gift-search">
            <label>받는 사람</label>
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="닉네임 또는 이메일로 검색"
                value={searchQuery}
                onChange={(e) => handleSearchUser(e.target.value)}
              />
              {selectedReceiver && (
                <span className="selected-badge">{selectedReceiver.nickname}</span>
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="search-results">
                {searchResults.map(user => (
                  <li key={user.id} onClick={() => handleSelectReceiver(user)}>
                    <strong>{user.nickname}</strong>
                    <span>{user.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="gift-message-field">
            <label>선물 메시지</label>
            <textarea
              placeholder="선물과 함께 보낼 메시지를 작성하세요"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default GiftSection;
