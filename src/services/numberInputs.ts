// Numeric fields start at 0: typing "5" used to give "05". This applies to every
// <input type="number"> of the app without touching each form:
// - on focus, a lone "0" is selected so the first digit typed replaces it;
// - while typing, leading zeros are removed ("05" -> "5", "007" -> "7"; "0.5" is kept).

// Native setter: bypasses React's value tracker so React still sees the change
// and updates its state with the cleaned value.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement && target.type === 'number';

export const stripLeadingZeros = (value: string): string => value.replace(/^(-?)0+(?=\d)/, '$1');

export function installNumberInputFix(): void {
  document.addEventListener(
    'focusin',
    (event) => {
      const input = event.target;
      if (isNumberInput(input) && input.value === '0' && !input.readOnly) {
        // Wait for the focus to settle (mouse click would otherwise drop the selection).
        setTimeout(() => {
          if (document.activeElement === input && input.value === '0') input.select();
        }, 0);
      }
    },
    true
  );

  // Capture phase on document runs before React's listener on the root element.
  document.addEventListener(
    'input',
    (event) => {
      const input = event.target;
      if (!isNumberInput(input) || !nativeValueSetter) return;
      const cleaned = stripLeadingZeros(input.value);
      if (cleaned !== input.value) nativeValueSetter.call(input, cleaned);
    },
    true
  );
}
