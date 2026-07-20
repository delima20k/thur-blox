export const createElement = (tag, attrs = {}, content) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null) return;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key === 'checked') {
      el.checked = value === true || value === 'checked';
      if (el.checked) el.setAttribute('checked', 'checked');
    } else if (key === 'selected') {
      el.selected = value === true || value === 'selected';
      if (el.selected) el.setAttribute('selected', 'selected');
    } else if (key === 'disabled') {
      el.disabled = value === true || value === 'disabled';
      if (el.disabled) el.setAttribute('disabled', 'disabled');
    } else if (key === 'hidden') {
      el.hidden = value === true || value === 'hidden';
      if (el.hidden) el.setAttribute('hidden', 'hidden');
    } else if (key === 'readonly' || key === 'readOnly') {
      el.readOnly = value === true || value === 'readonly';
      if (el.readOnly) el.setAttribute('readonly', 'readonly');
    } else if (key === 'value') {
      el.value = value == null ? '' : String(value);
      el.setAttribute('value', el.value);
    }
    else el.setAttribute(key, value);
  });
  if (typeof content === 'string' || typeof content === 'number') el.textContent = content;
  else if (content instanceof Node) el.append(content);
  else if (Array.isArray(content)) content.filter(Boolean).forEach((child) => el.append(child));
  return el;
};
