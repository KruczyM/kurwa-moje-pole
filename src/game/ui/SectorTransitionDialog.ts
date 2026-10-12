import './sector-transition.css';

/** One modal for confirmation, loading and recoverable download errors. */
export class SectorTransitionDialog {
  private root = document.createElement('dialog');
  private message = document.createElement('p');
  private progress = document.createElement('progress');
  private yes = document.createElement('button');
  private no = document.createElement('button');
  private resolve?: (accepted: boolean) => void;

  constructor() {
    this.root.className = 'sector-transition';
    this.root.setAttribute('aria-labelledby', 'sector-transition-title');
    const title = document.createElement('h2');
    title.id = 'sector-transition-title';
    title.textContent = 'Przejście do nowego sektora';
    this.message.setAttribute('aria-live', 'polite');
    this.progress.setAttribute('aria-label', 'Postęp ładowania sektora');
    this.yes.type = this.no.type = 'button';
    this.yes.onclick = () => this.answer(true);
    this.no.onclick = () => this.answer(false);
    this.root.oncancel = (event) => {
      event.preventDefault();
      if (this.resolve && !this.no.hidden) this.answer(false);
    };
    const actions = document.createElement('div');
    actions.append(this.no, this.yes);
    this.root.append(title, this.message, this.progress, actions);
    document.body.append(this.root);
  }

  private answer(value: boolean) {
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.(value);
  }

  ask(error = false): Promise<boolean> {
    this.message.textContent = error
      ? 'Nie udało się wczytać sektora. Ponowić próbę czy wrócić do poprzedniego sektora?'
      : 'Przejść dalej? Poprzedni sektor zostanie zwolniony, a nowy załadowany.';
    this.yes.textContent = error ? 'Spróbuj ponownie' : 'Tak, przejdź';
    this.no.textContent = error ? 'Wróć' : 'Zostań tutaj';
    this.yes.hidden = this.no.hidden = false;
    this.progress.hidden = true;
    if (!this.root.open) this.root.showModal();
    this.no.focus();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  loading(loaded = 0, total = 0) {
    this.yes.hidden = this.no.hidden = true;
    this.progress.hidden = false;
    this.progress.max = Math.max(1, total);
    this.progress.value = loaded;
    this.message.textContent = `Ładowanie sektora… ${loaded}/${total}`;
    if (!this.root.open) this.root.showModal();
  }

  close() {
    this.root.close();
  }
  dispose() {
    this.answer(false);
    this.root.close();
    this.root.remove();
    this.yes.onclick = this.no.onclick = this.root.oncancel = null;
  }
}
