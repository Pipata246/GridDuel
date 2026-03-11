;(async function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const isTelegramWebApp = !!tg;

  const SUPABASE_URL = 'https://gmklycilmztxetbpoqij.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdta2x5Y2lsbXp0eGV0YnBvcWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQ4ODAsImV4cCI6MjA4ODgwMDg4MH0.j1BakH1ovkivrxg5ytNFguURnp8fo5Hp2HCtZXspco8';

  const supabaseClient =
    window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  // Делаем клиент доступным во всех скриптах
  if (supabaseClient) {
    window.supabaseClient = supabaseClient;
  }

  const usernameEl = document.getElementById('username');
  const avatarEl = document.getElementById('avatar');
  const avatarInitialsEl = document.getElementById('avatar-initials');

  function getInitials(name) {
    if (!name) return 'SD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function applyUser(tgInstance) {
    const user = tgInstance.initDataUnsafe && tgInstance.initDataUnsafe.user;

    if (user) {
      const displayName =
        (user.first_name && user.last_name
          ? user.first_name + ' ' + user.last_name
          : user.first_name || user.username) || 'Игрок';

      if (usernameEl) {
        usernameEl.textContent = displayName;
      }

      if (avatarEl && avatarInitialsEl) {
        if (user.photo_url) {
          const img = new Image();
          img.src = user.photo_url;
          img.alt = displayName;
          img.onload = function () {
            avatarEl.innerHTML = '';
            avatarEl.appendChild(img);
          };
          img.onerror = function () {
            avatarInitialsEl.textContent = getInitials(displayName);
          };
        } else {
          avatarInitialsEl.textContent = getInitials(displayName);
        }
      }
    } else {
      if (usernameEl) {
        usernameEl.textContent = 'Гость';
      }
      if (avatarInitialsEl) {
        avatarInitialsEl.textContent = 'SD';
      }
    }
  }

  async function upsertUserInSupabase(tgInstance) {
    if (!supabaseClient || !tgInstance) return;

    const user = tgInstance.initDataUnsafe && tgInstance.initDataUnsafe.user;
    if (!user || !user.id) return;

    try {
      await supabaseClient
        .from('users')
        .upsert(
          {
            telegram_id: user.id,
            username: user.username || null,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            language_code: user.language_code || null,
            photo_url: user.photo_url || null,
            last_seen_at: new Date().toISOString()
          },
          { onConflict: 'telegram_id' }
        )
        .throwOnError();

      const { data } = await supabaseClient
        .from('users')
        .select('id, balance')
        .eq('telegram_id', user.id)
        .single();

      window.currentUserId = data && data.id;
      window.currentUserBalance = data && typeof data.balance === 'number' ? data.balance : 0;
    } catch (e) {
      // ignore client-side errors, Supabase is optional augmentation
    }
  }

  function tryFullscreen(tgInstance) {
    if (!tgInstance) return;

    try {
      tgInstance.expand();
    } catch (e) {}

    try {
      if (typeof tgInstance.requestFullscreen === 'function') {
        tgInstance.requestFullscreen();
      } else if (typeof tgInstance.enableFullscreen === 'function') {
        tgInstance.enableFullscreen();
      }
    } catch (e) {}
  }

  function initFullscreen(tgInstance) {
    if (!tgInstance) return;

    try {
      tgInstance.ready();
    } catch (e) {}

    try {
      if (typeof tgInstance.setHeaderColor === 'function') {
        tgInstance.setHeaderColor('#0f172a');
      }
      if (typeof tgInstance.setBackgroundColor === 'function') {
        tgInstance.setBackgroundColor('#080714');
      }
    } catch (e) {}

    tryFullscreen(tgInstance);

    const retryDelays = [50, 100, 200, 300, 500, 1000, 2000, 3000];

    retryDelays.forEach(function (delay) {
      setTimeout(function () {
        tryFullscreen(tgInstance);
      }, delay);
    });

    if (typeof tgInstance.onEvent === 'function') {
      tgInstance.onEvent('viewportChanged', function () {
        setTimeout(function () {
          tryFullscreen(tgInstance);
        }, 50);
      });
    }

    window.addEventListener('resize', function () {
      setTimeout(function () {
        tryFullscreen(tgInstance);
      }, 50);
    });

    window.addEventListener('load', function () {
      setTimeout(function () {
        tryFullscreen(tgInstance);
      }, 50);
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        setTimeout(function () {
          tryFullscreen(tgInstance);
        }, 50);
      }
    });

    window.addEventListener('focus', function () {
      setTimeout(function () {
        tryFullscreen(tgInstance);
      }, 50);
    });

    setInterval(function () {
      tryFullscreen(tgInstance);
    }, 5000);
  }

  if (isTelegramWebApp) {
    initFullscreen(tg);
    applyUser(tg);
    await upsertUserInSupabase(tg);

    const welcomeOverlay = document.getElementById('welcome-overlay');
    const welcomeAccept = document.getElementById('welcome-accept');

    if (welcomeOverlay && welcomeAccept) {
      try {
        const { data: userRow } = await supabaseClient
          .from('users')
          .select('id, terms_accepted')
          .eq('id', window.currentUserId)
          .single();

        const alreadyAccepted = userRow && userRow.terms_accepted;

        if (alreadyAccepted) {
          welcomeOverlay.classList.add('welcome-overlay--hidden');
        } else {
          welcomeOverlay.classList.remove('welcome-overlay--hidden');
          welcomeAccept.onclick = async function () {
            try {
              await supabaseClient
                .from('users')
                .update({
                  terms_accepted: true,
                  terms_accepted_at: new Date().toISOString()
                })
                .eq('id', window.currentUserId)
                .throwOnError();
              welcomeOverlay.classList.add('welcome-overlay--hidden');
            } catch (e) {
              // если не удалось обновить, оставляем экран
            }
          };
        }
      } catch (e) {
        // если не смогли прочитать пользователя, оставляем оверлей
      }
    }
  } else {
    if (usernameEl) {
      usernameEl.textContent = 'Гость';
    }
    if (avatarInitialsEl) {
      avatarInitialsEl.textContent = 'SD';
    }
  }
})();

;(function attachBalanceHandlers() {
  const supabaseClient = window.supabaseClient || null;
  const gamesPage = document.getElementById('page-games');
  const balancePage = document.getElementById('page-balance');
  const navItems = document.querySelectorAll('.nav-item');
  const balanceAmountEl = document.getElementById('balance-amount');
  const transactionsPanel = document.getElementById('transactions-panel');
  const transactionsOpen = document.getElementById('transactions-open');
  const transactionsClose = document.getElementById('transactions-close');
  const transactionsClear = document.getElementById('transactions-clear');
  const transactionsList = document.getElementById('transactions-list');
  const transactionsEmpty = document.getElementById('transactions-empty');
  const transactionsError = document.getElementById('transactions-error');
  const alertModal = document.getElementById('alert-modal');
  const alertModalMessage = document.getElementById('alert-modal-message');
  const alertModalClose = document.getElementById('alert-modal-close');

  function setActivePage(index) {
    if (!gamesPage || !balancePage) return;
    if (index === 1) {
      gamesPage.classList.remove('page--active');
      balancePage.classList.add('page--active');
    } else {
      balancePage.classList.remove('page--active');
      gamesPage.classList.add('page--active');
    }
  }

  navItems.forEach(function (btn, index) {
    btn.addEventListener('click', function () {
      navItems.forEach(function (b) {
        b.classList.remove('nav-item--active');
      });
      btn.classList.add('nav-item--active');
      setActivePage(index);
    });
  });

  function showAlert(message) {
    if (!alertModal || !alertModalMessage) return;
    alertModalMessage.textContent = message;
    alertModal.classList.add('alert-modal--open');
  }

  if (alertModal && alertModalClose) {
    alertModalClose.addEventListener('click', function () {
      alertModal.classList.remove('alert-modal--open');
    });
    alertModal.addEventListener('click', function (e) {
      if (e.target === alertModal) {
        alertModal.classList.remove('alert-modal--open');
      }
    });
  }

  async function loadBalanceAndTransactions() {
    if (!supabaseClient || !window.currentUserId) return;

    try {
      const { data: userRow } = await supabaseClient
        .from('users')
        .select('balance')
        .eq('id', window.currentUserId)
        .single();

      const { data: txData, error } = await supabaseClient
        .from('transactions')
        .select('delta, comment')
        .eq('user_id', window.currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const balance =
        userRow && typeof userRow.balance === 'number'
          ? userRow.balance
          : (window.currentUserBalance || 0);

      if (balanceAmountEl) {
        balanceAmountEl.textContent = balance.toFixed(0);
      }

      transactionsList.innerHTML = '';

      if (!txData || txData.length === 0) {
        transactionsEmpty.style.display = 'block';
      } else {
        transactionsEmpty.style.display = 'none';
        txData.forEach(function (t) {
          const row = document.createElement('div');
          row.className = 'transactions-item';

          const amount = document.createElement('div');
          amount.className =
            'transactions-item-amount ' +
            (t.delta >= 0 ? 'transactions-item-amount--positive' : 'transactions-item-amount--negative');
          const sign = t.delta > 0 ? '+' : '';
          amount.textContent = sign + Number(t.delta).toFixed(0);

          const comment = document.createElement('div');
          comment.className = 'transactions-item-comment';
          comment.textContent = t.comment || '';

          row.appendChild(amount);
          row.appendChild(comment);
          transactionsList.appendChild(row);
        });
      }

      transactionsError.textContent = '';
    } catch (e) {
      transactionsError.textContent = 'Не удалось загрузить историю транзакций.';
    }
  }

  if (transactionsOpen && transactionsPanel) {
    transactionsOpen.addEventListener('click', function () {
      transactionsPanel.classList.add('transactions-panel--open');
      loadBalanceAndTransactions();
    });
  }

  if (transactionsClose && transactionsPanel) {
    transactionsClose.addEventListener('click', function () {
      transactionsPanel.classList.remove('transactions-panel--open');
    });
  }

  if (transactionsClear) {
    transactionsClear.addEventListener('click', async function () {
      transactionsError.textContent = '';
      if (!supabaseClient || !window.currentUserId) {
        transactionsError.textContent = 'Не удалось определить пользователя.';
        return;
      }

      const hasTransactions = transactionsList && transactionsList.children.length > 0;
      if (!hasTransactions) {
        showAlert('У тебя ещё нет транзакций, чтобы очистить историю.');
        return;
      }

      try {
        const { error } = await supabaseClient
          .from('transactions')
          .delete()
          .eq('user_id', window.currentUserId);
        if (error) throw error;

        transactionsList.innerHTML = '';
        transactionsEmpty.style.display = 'block';
        if (balanceAmountEl) balanceAmountEl.textContent = '0';
      } catch (e) {
        transactionsError.textContent = 'Не удалось очистить историю.';
      }
    });
  }
})();

