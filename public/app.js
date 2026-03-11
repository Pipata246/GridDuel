;(async function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const isTelegramWebApp = !!tg;

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

  async function syncUserWithBackend(tgInstance) {
    if (!tgInstance) return;
    const user = tgInstance.initDataUnsafe && tgInstance.initDataUnsafe.user;
    if (!user || !user.id) return;

    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ telegramUser: user })
      });

      if (!response.ok) return null;
      const payload = await response.json();
      if (!payload || !payload.ok || !payload.user) return null;

      const backendUser = payload.user;
      window.currentUserId = backendUser.id;
      window.currentUserBalance =
        typeof backendUser.balance === 'number' ? backendUser.balance : 0;
      window.currentUserTermsAccepted = !!backendUser.termsAccepted;
      return backendUser;
    } catch (e) {
      // если бэк недоступен, просто не трогаем состояние
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

    const welcomeOverlay = document.getElementById('welcome-overlay');
    const welcomeAccept = document.getElementById('welcome-accept');
    const welcomeLoader = document.getElementById('welcome-loader');

    // Прелоад данных сразу при старте
    let bootstrapFinished = false;

    const bootstrap = (async function () {
      try {
        await syncUserWithBackend(tg);

        if (window.currentUserId) {
          try {
            const response = await fetch('/api/user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userId: window.currentUserId,
                action: 'load_balance'
              })
            });

            if (response.ok) {
              const payload = await response.json();
              if (payload && payload.ok) {
                const balance =
                  payload && typeof payload.balance === 'number'
                    ? payload.balance
                    : window.currentUserBalance || 0;

                window.currentUserBalance = balance;
                window.cachedTransactions = payload.transactions || [];

                const balanceAmountEl = document.getElementById('balance-amount');
                if (balanceAmountEl) {
                  balanceAmountEl.textContent = balance.toFixed(0);
                }
              }
            }
          } catch (e) {
            // игнорируем, не блокируем старт
          }
        }
      } finally {
        bootstrapFinished = true;
        if (welcomeOverlay) {
          welcomeOverlay.classList.remove('welcome-overlay--loading');
        }
        if (welcomeAccept) {
          welcomeAccept.disabled = false;
        }
      }
    })();

    if (welcomeOverlay && welcomeAccept) {
      welcomeOverlay.classList.add('welcome-overlay--loading');
      welcomeAccept.disabled = true;

      const alertModal = document.getElementById('alert-modal');
      const alertModalMessage = document.getElementById('alert-modal-message');
      const alertModalClose = document.getElementById('alert-modal-close');

      welcomeAccept.addEventListener('click', function () {
        if (!bootstrapFinished) {
          // если по какой-то причине ещё грузится, просто игнорируем клик
          return;
        }

        welcomeOverlay.classList.add('welcome-overlay--hidden');

        // После приветственного экрана, если пользователь ещё не принял правила — показываем модалку согласия
        if (!window.currentUserTermsAccepted && window.currentUserId && alertModal && alertModalMessage && alertModalClose) {
          alertModalMessage.textContent =
            'Играя в GridDuel, ты подтверждаешь, что будешь соблюдать правила и относиться уважительно к соперникам.';
          alertModal.classList.add('alert-modal--open');

          const handleAccept = async function () {
            try {
              await fetch('/api/user', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: window.currentUserId,
                  action: 'accept_terms'
                })
              });
              window.currentUserTermsAccepted = true;
            } catch (e) {
              // игнорируем, не блокируем закрытие
            } finally {
              alertModalClose.removeEventListener('click', handleAccept);
            }
          };

          alertModalClose.addEventListener('click', handleAccept);
        }
      });
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
    if (!window.currentUserId) return;

    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: window.currentUserId, action: 'load_balance' })
      });

      if (!response.ok) {
        transactionsError.textContent = 'Не удалось загрузить историю транзакций.';
        return;
      }

      const payload = await response.json();
      if (!payload || !payload.ok) {
        transactionsError.textContent = 'Не удалось загрузить историю транзакций.';
        return;
      }

      const balance =
        payload && typeof payload.balance === 'number'
          ? payload.balance
          : window.currentUserBalance || 0;

      if (balanceAmountEl) {
        balanceAmountEl.textContent = balance.toFixed(0);
      }

      const txData = payload.transactions || [];
      window.cachedTransactions = txData;

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
      if (!window.currentUserId) {
        transactionsError.textContent = 'Не удалось определить пользователя.';
        return;
      }

      const hasTransactions = transactionsList && transactionsList.children.length > 0;
      if (!hasTransactions) {
        showAlert('У тебя ещё нет транзакций, чтобы очистить историю.');
        return;
      }

      try {
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: window.currentUserId, action: 'clear_transactions' })
        });

        if (!response.ok) {
          throw new Error('Failed to clear');
        }

        transactionsList.innerHTML = '';
        transactionsEmpty.style.display = 'block';
        if (balanceAmountEl) balanceAmountEl.textContent = '0';
      } catch (e) {
        transactionsError.textContent = 'Не удалось очистить историю.';
      }
    });
  }
})();

