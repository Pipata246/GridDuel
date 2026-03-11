(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
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

  if (tg) {
    tg.ready();

    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) {
      const displayName =
        (user.first_name && user.last_name
          ? user.first_name + ' ' + user.last_name
          : user.first_name || user.username) || 'Игрок';

      usernameEl.textContent = displayName;

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
    } else {
      usernameEl.textContent = 'Гость';
      avatarInitialsEl.textContent = 'SD';
    }
  } else {
    usernameEl.textContent = 'Гость';
    avatarInitialsEl.textContent = 'SD';
  }
})();

