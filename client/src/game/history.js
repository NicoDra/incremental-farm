// Chanchos S.A. — M1.5-D: deshacer/rehacer de construcciones (Ctrl+Z / Ctrl+Y).
// Acciones planas: place | sell | move. Cada una guarda todo lo necesario para
// que main.js aplique el inverso; este módulo no toca sim ni estado.

export const HISTORY_LIMIT = 100;

export class History {
  constructor(limit = HISTORY_LIMIT) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  record(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  peekUndo() {
    return this.undoStack.length ? this.undoStack[this.undoStack.length - 1] : null;
  }

  peekRedo() {
    return this.redoStack.length ? this.redoStack[this.redoStack.length - 1] : null;
  }

  // Deshacer: saca del undo y deja listo en redo. Llamar solo tras validar
  // (peek) o usar dropUndo si la acción ya no es aplicable.
  undo() {
    const a = this.peekUndo();
    if (!a) return null;
    this.undoStack.pop();
    this.redoStack.push(a);
    return a;
  }

  redo() {
    const a = this.peekRedo();
    if (!a) return null;
    this.redoStack.pop();
    this.undoStack.push(a);
    return a;
  }

  dropUndo() {
    return this.undoStack.pop() || null;
  }

  dropRedo() {
    return this.redoStack.pop() || null;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
