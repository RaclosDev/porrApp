import { fireEvent, screen } from '@testing-library/react';

/** Botón de un SelectMenu por su etiqueta: se anuncia como «Etiqueta: opción elegida». */
export const getSelectMenu = (label: string) =>
  screen.getByRole('button', {
    name: (name) => name === label || name.startsWith(`${label}: `),
  });

/** Opciones del menú de un SelectMenu. */
export function menuOptions(trigger: HTMLElement) {
  const menu = document.getElementById(trigger.getAttribute('popovertarget') ?? '');
  if (!menu) throw new Error('SelectMenu sin menú');
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
}

/** Textos de las opciones, sin la marca de la elegida. */
export const optionLabels = (trigger: HTMLElement) =>
  menuOptions(trigger).map((item) => item.querySelector('.select-menu-label')?.textContent ?? '');

/** Elige la opción con ese valor: el equivalente a un `fireEvent.change` sobre un `<select>`. */
export function chooseOption(trigger: HTMLElement, value: string) {
  const option = menuOptions(trigger).find((item) => item.dataset.value === value);
  if (!option) throw new Error(`SelectMenu sin la opción ${value}`);
  fireEvent.click(option);
}

/** Textos de las opciones bajo el encabezado `group` (lo que era un `<optgroup>`). */
export function groupLabels(group: string) {
  const sep = document.querySelector(`[role="separator"][aria-label="${group}"]`);
  if (!sep) throw new Error(`SelectMenu sin el grupo ${group}`);
  const labels: string[] = [];
  for (let el = sep.nextElementSibling; el?.getAttribute('role') === 'menuitemradio';) {
    labels.push(el.querySelector('.select-menu-label')?.textContent ?? '');
    el = el.nextElementSibling;
  }
  return labels;
}

/** Cambia el valor de un campo, sea un SelectMenu o un `<input>`. */
export function setValue(el: HTMLElement, value: string) {
  if (el.hasAttribute('popovertarget')) chooseOption(el, value);
  else fireEvent.change(el, { target: { value } });
}
