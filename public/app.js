;(function () {
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
  } else {
    if (usernameEl) {
      usernameEl.textContent = 'Гость';
    }
    if (avatarInitialsEl) {
      avatarInitialsEl.textContent = 'SD';
    }
  }
})();

