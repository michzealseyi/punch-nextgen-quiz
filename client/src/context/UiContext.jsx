// App-wide toast and dialog. modal() returns a Promise<boolean>, so callers can `await` a confirmation.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BadgeCard } from '../components/common.jsx';
import { article, confetti, reducedMotion } from '../utils.js';

const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);

function Modal({ title, body, confirmLabel, cancelLabel, onDone }) {
  const ref = useRef(null);
  const okRef = useRef(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    dlg.showModal();
    okRef.current?.focus();
    return () => { if (dlg.open) dlg.close(); };
  }, []);

  // Play the close animation, then report the answer
  const finish = (ok) => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onDone(ok), reducedMotion() ? 0 : 180);
  };

  return (
    <dialog
      ref={ref}
      className={'modal' + (closing ? ' is-closing' : '')}
      aria-labelledby="modalTitle"
      onCancel={(e) => { e.preventDefault(); finish(false); }}
      onClick={(e) => { if (e.target === ref.current) finish(false); }}
    >
      <div className="modal__card">
        <h2 className="modal__title" id="modalTitle">{title}</h2>
        <div className="modal__body">{body}</div>
        <div className="modal__actions">
          {cancelLabel && <button type="button" className="btn btn--ghost" onClick={() => finish(false)}>{cancelLabel}</button>}
          <button ref={okRef} type="button" className="btn" onClick={() => finish(true)}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}

export function UiProvider({ children }) {
  const [toastState, setToastState] = useState({ msg: '', error: false, on: false });
  const toastTimer = useRef();
  const [dialog, setDialog] = useState(null);
  const dialogId = useRef(0);

  const toast = useCallback((msg, error = false) => {
    setToastState({ msg, error, on: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState((t) => ({ ...t, on: false })), 3200);
  }, []);

  const modal = useCallback((opts) => new Promise((resolve) => {
    setDialog({ confirmLabel: 'OK', cancelLabel: 'Cancel', ...opts, resolve, id: ++dialogId.current });
  }), []);

  // Level-ups and new badges get their own moment
  const celebrate = useCallback(async ({ newBadges = [], levelUp = false, level = null } = {}) => {
    if (!newBadges.length && !levelUp) return;
    confetti(40);
    await modal({
      title: newBadges.length ? (newBadges.length > 1 ? 'New badges unlocked' : 'Badge unlocked') : 'Level up!',
      body: (
        <>
          {levelUp && level && (
            <div className="levelup">
              <span className="levelup__num">{level.number}</span>
              <p><b>Level up!</b><br />You’re now {article(level.name)} {level.name}.</p>
            </div>
          )}
          {newBadges.length > 0 && (
            <ul className="badges badges--reveal">{newBadges.map((b) => <BadgeCard key={b.id} badge={b} earned />)}</ul>
          )}
        </>
      ),
      confirmLabel: 'Nice!',
      cancelLabel: null,
    });
  }, [modal]);

  return (
    <UiContext.Provider value={{ toast, modal, celebrate }}>
      {children}
      <div className={'toast' + (toastState.on ? ' is-on' : '') + (toastState.error ? ' toast--error' : '')} role="status" aria-live="polite">
        {toastState.msg}
      </div>
      {dialog && (
        <Modal key={dialog.id} {...dialog} onDone={(ok) => { setDialog(null); dialog.resolve(ok); }} />
      )}
    </UiContext.Provider>
  );
}
