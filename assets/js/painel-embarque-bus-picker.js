(function () {
  'use strict';
  window.KobBoardingBusPicker = function (root) {
    var select = root.querySelector('#embarque-buses');
    var wrapper = root.querySelector('.embarque-bus-picker');
    var trigger = root.querySelector('#embarque-bus-trigger');
    var menu = root.querySelector('#embarque-bus-options');
    var active = 0, opened = false, typed = '', typedAt = 0;
    function options() { return Array.from(select.options); }
    function highlight(index) {
      var items = Array.from(menu.children);
      active = Math.max(0, Math.min(index, items.length - 1));
      items.forEach(function (item, i) { item.classList.toggle('is-active', i === active); });
      if (opened && items[active]) {
        trigger.setAttribute('aria-activedescendant', items[active].id);
        items[active].scrollIntoView({ block: 'nearest' });
      }
    }
    function close() {
      opened = false; menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
    }
    function refresh() {
      var current = select.selectedOptions[0];
      trigger.querySelector('span').textContent = current ? current.label : '';
      menu.replaceChildren();
      options().forEach(function (option, index) {
        var item = document.createElement('li');
        item.id = 'embarque-bus-option-' + option.value;
        item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected));
        item.dataset.value = option.value;
        item.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
        var label = document.createElement('span'); label.textContent = option.textContent;
        item.appendChild(label); menu.appendChild(item);
        if (option.selected && !opened) active = index;
      });
      highlight(active);
    }
    function open() {
      refresh(); opened = true; menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      highlight(Math.max(0, select.selectedIndex));
    }
    function choose(index) {
      var option = options()[index];
      if (!option) return;
      select.value = option.value; close(); trigger.focus();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    trigger.addEventListener('click', function () { if (opened) close(); else open(); });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key === 'Tab') { close(); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (!opened) { open(); return; }
        if (event.key === 'Enter' || event.key === ' ') choose(active);
        else highlight(event.key === 'Home' ? 0 : event.key === 'End' ? options().length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (!opened) open();
        typed = Date.now() - typedAt < 700 ? typed + event.key : event.key; typedAt = Date.now();
        var index = options().findIndex(function (option) { return option.textContent.toLocaleLowerCase(root.lang).startsWith(typed.toLocaleLowerCase(root.lang)); });
        if (index >= 0) highlight(index);
      }
    });
    menu.addEventListener('click', function (event) {
      var item = event.target.closest('[role="option"]');
      if (item) choose(Array.from(menu.children).indexOf(item));
    });
    document.addEventListener('click', function (event) { if (!wrapper.contains(event.target)) close(); });
    root.addEventListener('close', close);
    return { refresh: refresh };
  };
})();
