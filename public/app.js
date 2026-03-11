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
      window.currentUserTermsAcceptedAt = backendUser.termsAcceptedAt || null;
      window.currentUserTelegramId = backendUser.telegramId || null;
      window.currentUserUsername = backendUser.username || null;
      window.currentUserReferralCode = backendUser.referralCode || null;

      // Мгновенно обновляем профиль после загрузки с бэка
      const profileUsernameEl = document.getElementById('profile-username');
      const profileTelegramIdEl = document.getElementById('profile-telegram-id');
      const profileTermsStatusEl = document.getElementById('profile-terms-status');
      const profileRefCodeEl = document.getElementById('profile-ref-code');

      if (profileUsernameEl && window.currentUserUsername) {
        profileUsernameEl.textContent = window.currentUserUsername;
      }
      if (profileTelegramIdEl && window.currentUserTelegramId) {
        profileTelegramIdEl.textContent = String(window.currentUserTelegramId);
      }
      if (profileRefCodeEl && window.currentUserReferralCode) {
        profileRefCodeEl.textContent = window.currentUserReferralCode;
      }
      if (profileTermsStatusEl) {
        if (!window.currentUserTermsAccepted) {
          profileTermsStatusEl.textContent = 'Ещё не приняты';
        } else if (!window.currentUserTermsAcceptedAt) {
          profileTermsStatusEl.textContent = 'Приняты';
        } else {
          const d = new Date(window.currentUserTermsAcceptedAt);
          if (!Number.isNaN(d.getTime())) {
            const formatter = new Intl.DateTimeFormat('ru-RU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
            profileTermsStatusEl.textContent = 'Приняты: ' + formatter.format(d);
          } else {
            profileTermsStatusEl.textContent = 'Приняты';
          }
        }
      }

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

    if (welcomeOverlay && welcomeAccept && welcomeLoader) {
      let isStarting = false;

      const alertModal = document.getElementById('alert-modal');
      const alertModalMessage = document.getElementById('alert-modal-message');
      const alertModalClose = document.getElementById('alert-modal-close');

      welcomeAccept.addEventListener('click', async function () {
        if (isStarting) return;
        isStarting = true;

        welcomeAccept.disabled = true;
        welcomeOverlay.classList.add('welcome-overlay--loading');

        try {
          const backendUser = await syncUserWithBackend(tg);

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

          welcomeOverlay.classList.add('welcome-overlay--hidden');

          const termsAlreadyAccepted =
            (backendUser && backendUser.termsAccepted) || window.currentUserTermsAccepted;

          if (!termsAlreadyAccepted && window.currentUserId && alertModal && alertModalMessage && alertModalClose) {
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
                alertModal.classList.remove('alert-modal--open');
              }
            };

            alertModalClose.addEventListener('click', handleAccept);
          }
        } finally {
          welcomeOverlay.classList.remove('welcome-overlay--loading');
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
  const matchesPage = document.getElementById('page-matches');
  const balancePage = document.getElementById('page-balance');
  const profilePage = document.getElementById('page-profile');
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
    if (!gamesPage || !matchesPage || !balancePage || !profilePage) return;

    gamesPage.classList.remove('page--active');
    matchesPage.classList.remove('page--active');
    balancePage.classList.remove('page--active');
    profilePage.classList.remove('page--active');

    if (index === 0) {
      gamesPage.classList.add('page--active');
    } else if (index === 1) {
      balancePage.classList.add('page--active');
    } else if (index === 2) {
      matchesPage.classList.add('page--active');
    } else if (index === 3) {
      profilePage.classList.add('page--active');
    } else {
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
      if (window.playNavSound) {
        window.playNavSound();
      }
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

  // Профиль
  const profileUsernameEl = document.getElementById('profile-username');
  const profileTelegramIdEl = document.getElementById('profile-telegram-id');
  const profileTermsStatusEl = document.getElementById('profile-terms-status');
  const profileRefCodeEl = document.getElementById('profile-ref-code');
  const profileRefCopyBtn = document.getElementById('profile-ref-copy');
  const soundToggle = document.getElementById('profile-sound-toggle');
  const soundVolume = document.getElementById('profile-sound-volume');
  const statsOpenBtn = document.getElementById('profile-stats-open');
  const statsModal = document.getElementById('stats-modal');
  const statsModalClose = document.getElementById('stats-modal-close');

  function formatTermsStatus() {
    if (!profileTermsStatusEl) return;
    if (!window.currentUserTermsAccepted) {
      profileTermsStatusEl.textContent = 'Ещё не приняты';
      return;
    }
    if (!window.currentUserTermsAcceptedAt) {
      profileTermsStatusEl.textContent = 'Приняты';
      return;
    }
    const d = new Date(window.currentUserTermsAcceptedAt);
    if (Number.isNaN(d.getTime())) {
      profileTermsStatusEl.textContent = 'Приняты';
      return;
    }
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    profileTermsStatusEl.textContent = 'Приняты: ' + formatter.format(d);
  }

  function applyProfileFromCache() {
    if (profileUsernameEl && window.currentUserUsername) {
      profileUsernameEl.textContent = window.currentUserUsername;
    }
    if (profileTelegramIdEl && window.currentUserTelegramId) {
      profileTelegramIdEl.textContent = String(window.currentUserTelegramId);
    }
    if (profileRefCodeEl && window.currentUserReferralCode) {
      profileRefCodeEl.textContent = window.currentUserReferralCode;
    }
    formatTermsStatus();
  }

  applyProfileFromCache();

  let copySound;

  if (profileRefCopyBtn && profileRefCodeEl) {
    profileRefCopyBtn.addEventListener('click', function () {
      const code = profileRefCodeEl.textContent || '';
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(function () {});
      }

      const toast = document.getElementById('copy-toast');
      if (!toast) return;
      toast.classList.add('toast--visible');
      setTimeout(function () {
        toast.classList.remove('toast--visible');
      }, 1500);

      // Звук уведомления о копировании
      if (soundToggle && soundToggle.checked) {
        try {
          if (!copySound) {
            copySound = new Audio('/sounds/uved.wav');
          }
          const vol = soundVolume ? Number(soundVolume.value) : 80;
          const volume =
            Number.isNaN(vol) ? 0.8 : Math.max(0, Math.min(1, vol / 100));
          copySound.volume = volume;
          copySound.currentTime = 0;
          copySound.play().catch(function () {});
        } catch (e) {
          // игнорируем ошибки аудио
        }
      }
    });
  }

  // Настройки звука — локальное хранилище
  const SOUND_ENABLED_KEY = 'gridduel_sound_enabled';
  const SOUND_VOLUME_KEY = 'gridduel_sound_volume';

  const savedEnabled = localStorage.getItem(SOUND_ENABLED_KEY);
  const savedVolume = localStorage.getItem(SOUND_VOLUME_KEY);

  if (soundToggle) {
    soundToggle.checked = savedEnabled !== '0';
  }
  if (soundVolume) {
    soundVolume.value = savedVolume !== null ? savedVolume : '80';
  }

  if (soundToggle) {
    soundToggle.addEventListener('change', function () {
      localStorage.setItem(SOUND_ENABLED_KEY, soundToggle.checked ? '1' : '0');
    });
  }

  if (soundVolume) {
    soundVolume.addEventListener('input', function () {
      localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume.value));
    });
  }

  // Модалка статистики
  if (statsOpenBtn && statsModal && statsModalClose) {
    statsOpenBtn.addEventListener('click', function () {
      statsModal.classList.add('stats-modal--open');
    });
    statsModalClose.addEventListener('click', function () {
      statsModal.classList.remove('stats-modal--open');
    });
  }

  // Звук меню навигации
  (function initNavSound() {
    let navSound;

    function getVolume() {
      if (!soundVolume) return 0.8;
      const vol = Number(soundVolume.value);
      if (Number.isNaN(vol)) return 0.8;
      return Math.max(0, Math.min(1, vol / 100));
    }

    window.playNavSound = function () {
      if (!soundToggle || !soundToggle.checked) return;

      try {
        if (!navSound) {
          navSound = new Audio('/sounds/menu.mp3');
          navSound.volume = getVolume();
        } else {
          navSound.volume = getVolume();
        }

        navSound.currentTime = 0;
        navSound.play().catch(function () {});
      } catch (e) {
        // игнорируем ошибки аудио
      }
    };
  })();

  // Звук tap при клике по всем элементам, кроме навигации и кнопки «Скопировать»
  (function initTapSound() {
    let tapSound;

    function getVolume() {
      if (!soundVolume) return 0.8;
      const vol = Number(soundVolume.value);
      if (Number.isNaN(vol)) return 0.8;
      return Math.max(0, Math.min(1, vol / 100));
    }

    function playTapSound() {
      if (!soundToggle || !soundToggle.checked) return;
      try {
        if (!tapSound) {
          tapSound = new Audio('/sounds/tap.wav');
        }
        tapSound.volume = getVolume();
        tapSound.currentTime = 0;
        tapSound.play().catch(function () {});
      } catch (e) {}
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('.nav')) return;
      if (e.target.id === 'profile-ref-copy' || e.target.closest('#profile-ref-copy')) return;
      playTapSound();
    }, true);
  })();

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

