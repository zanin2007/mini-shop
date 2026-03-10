const db = require('../config/db');

/**
 * 이벤트 컨트롤러 (유저용)
 * - 진행중 이벤트 조회: 기간 내 활성 이벤트 + 본인 참여 여부
 * - 내 참여 목록: 참여한 이벤트 ID 배열 반환 (알림 페이지 참여 상태 유지용)
 * - 이벤트 참여: 기간/인원 검증 → 선착순(fcfs)이면 즉시 당첨 + 우편함 보상
 */

// 진행중인 이벤트 목록 — 활성 + 기간 내 이벤트, 본인 참여 여부 포함
exports.getActiveEvents = async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : null;
    if (userId) {
      const [events] = await db.execute(
        `SELECT e.*,
                (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) AS current_participants,
                (ep.id IS NOT NULL) AS is_participated
         FROM events e
         LEFT JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = ?
         WHERE e.is_active = true AND e.start_date <= NOW() AND e.end_date >= NOW()
         ORDER BY e.created_at DESC`,
        [userId]
      );
      for (const event of events) {
        event.is_participated = !!event.is_participated;
      }
      res.json(events);
    } else {
      const [events] = await db.execute(
        `SELECT e.*, (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) AS current_participants
         FROM events e
         WHERE e.is_active = true AND e.start_date <= NOW() AND e.end_date >= NOW()
         ORDER BY e.created_at DESC`
      );
      res.json(events);
    }
  } catch (error) {
    console.error('Get active events error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 참여한 이벤트 ID 목록
exports.getMyParticipations = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT event_id FROM event_participants WHERE user_id = ?',
      [req.user.userId]
    );
    res.json(rows.map(r => r.event_id));
  } catch (error) {
    console.error('Get my participations error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 참여 (트랜잭션으로 참여+보상 원자성 보장)
exports.participateEvent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const userId = req.user.userId;

    // FOR UPDATE로 이벤트 행 잠금 + 기간 검증을 DB NOW()로 처리 (타임존 일관성)
    const [events] = await connection.execute(
      'SELECT * FROM events WHERE id = ? AND is_active = true AND start_date <= NOW() AND end_date >= NOW() FOR UPDATE',
      [id]
    );
    if (events.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '이벤트를 찾을 수 없거나 기간이 아닙니다.' });
    }
    const event = events[0];

    // 행 잠금 상태에서 정확한 참여 인원 체크
    if (event.max_participants != null) {
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as cnt FROM event_participants WHERE event_id = ?', [id]
      );
      if (countResult[0].cnt >= event.max_participants) {
        await connection.rollback();
        return res.status(400).json({ message: '참여 인원이 마감되었습니다.' });
      }
    }

    await connection.execute('INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)', [id, userId]);

    // 선착순(fcfs) 이벤트면 즉시 당첨 처리
    if (event.type === 'fcfs') {
      await connection.execute(
        'UPDATE event_participants SET is_winner = true WHERE event_id = ? AND user_id = ?',
        [id, userId]
      );

      if (event.reward_type) {
        await connection.execute(
          `INSERT INTO mailbox (user_id, type, title, content, reward_type, reward_id, reward_amount)
           VALUES (?, 'event', ?, '선착순 이벤트에 참여하셨습니다! 보상을 수령해주세요.', ?, ?, ?)`,
          [userId, `🎊 ${event.title} 보상`, event.reward_type, event.reward_id, event.reward_amount]
        );
      }

      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'system', ?, '우편함에서 보상을 확인해주세요!')`,
        [userId, `🎊 ${event.title} 참여 완료!`]
      );
    }

    await connection.commit();
    res.json({ message: '이벤트에 참여했습니다!' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '이미 참여한 이벤트입니다.' });
    }
    console.error('Participate event error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};
