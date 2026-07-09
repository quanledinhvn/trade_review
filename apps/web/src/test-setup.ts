import '@testing-library/jest-dom';

window.HTMLElement.prototype.hasPointerCapture = () => false;

window.HTMLElement.prototype.setPointerCapture = () => undefined;

window.HTMLElement.prototype.releasePointerCapture = () => undefined;

window.HTMLElement.prototype.scrollIntoView = () => undefined;
