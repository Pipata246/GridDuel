import { supabase } from '../supabase/client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!supabase) {
    res.status(500).json({ ok: false, error: 'Supabase is not configured' });
    return;
  }

  const { telegramUser, userId, action } = req.body || {};

  try {
    if (telegramUser && telegramUser.id && (!action || action === 'sync')) {
      const upsertPayload = {
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null,
        language_code: telegramUser.language_code || null,
        photo_url: telegramUser.photo_url || null,
        last_seen_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from('users')
        .upsert(upsertPayload, { onConflict: 'telegram_id' });

      if (upsertError) {
        console.error('Supabase upsert user error', upsertError);
        throw upsertError;
      }

      const { data: userRow, error: selectError } = await supabase
        .from('users')
        .select('id, balance, terms_accepted, terms_accepted_at, telegram_id, username')
        .eq('telegram_id', telegramUser.id)
        .single();

      if (selectError) {
        console.error('Supabase select user error', selectError);
        throw selectError;
      }

      const referralCode = `X${String(userRow.telegram_id || '')
        .slice(-6)
        .toUpperCase()}`;

      return res.status(200).json({
        ok: true,
        user: {
          id: userRow.id,
          balance: typeof userRow.balance === 'number' ? userRow.balance : 0,
          termsAccepted: !!userRow.terms_accepted,
          termsAcceptedAt: userRow.terms_accepted_at,
          telegramId: userRow.telegram_id,
          username: userRow.username,
          referralCode
        }
      });
    }

    if (!userId) {
      res.status(400).json({ ok: false, error: 'userId is required for this action' });
      return;
    }

    if (action === 'accept_terms') {
      const { error } = await supabase
        .from('users')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Supabase update terms error', error);
        throw error;
      }

      return res.status(200).json({ ok: true });
    }

    if (action === 'load_balance') {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Supabase select balance error', userError);
        throw userError;
      }

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('delta, comment')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (txError) {
        console.error('Supabase select transactions error', txError);
        throw txError;
      }

      return res.status(200).json({
        ok: true,
        balance:
          userRow && typeof userRow.balance === 'number'
            ? userRow.balance
            : 0,
        transactions: txData || []
      });
    }

    if (action === 'clear_transactions') {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase delete transactions error', error);
        throw error;
      }

      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('Error in /api/user', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

