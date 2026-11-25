// تراجع وإعادة بلا حد (في الجلسة)، بحفظ لقطات JSON مضغوطة بالمقارنة النصية.
export class History {
  constructor(limit = Infinity) {
    this.undoStack = [];
    this.redoStack = [];
    this.limit = limit;
    this.last = null;
  }
  reset(state) {
    this.undoStack = [];
    this.redoStack = [];
    this.last = JSON.stringify(state);
  }
  // يُستدعى بعد كل تعديل مكتمل
  commit(state, label = '') {
    const s = JSON.stringify(state);
    if (s === this.last) return false;
    if (this.last != null) this.undoStack.push({ s: this.last, label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.last = s;
    return true;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  undo() {
    const e = this.undoStack.pop();
    if (!e) return null;
    this.redoStack.push({ s: this.last, label: e.label });
    this.last = e.s;
    return { state: JSON.parse(e.s), label: e.label };
  }
  redo() {
    const e = this.redoStack.pop();
    if (!e) return null;
    this.undoStack.push({ s: this.last, label: e.label });
    this.last = e.s;
    return { state: JSON.parse(e.s), label: e.label };
  }
}
