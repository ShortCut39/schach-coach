import '@testing-library/jest-dom/vitest';
import '../i18n';

// jsdom berechnet kein Layout. react-chessboard misst für Zug-Animationen die Feldbreite
// und bricht bei 0 ab. Deshalb liefern Elemente im Test eine feste Größe.
Element.prototype.getBoundingClientRect = function () {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 50,
    right: 50,
    width: 50,
    height: 50,
    toJSON: () => ({}),
  };
};
