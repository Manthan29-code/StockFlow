const Badge = {
  render(user, createdAt) {
    if (!user) return '';

    const initials = (user.username || 'U').substring(0, 2).toUpperCase();
    const color = user.color || '#635BFF';
    const dateFormatted = Format.dateTime(createdAt);
    const tooltipText = `Added by ${user.username}, ${dateFormatted}`;

    return `
      <span class="user-avatar-badge" style="background-color: ${color};" title="${tooltipText}">
        ${initials}
      </span>
    `;
  },
};

