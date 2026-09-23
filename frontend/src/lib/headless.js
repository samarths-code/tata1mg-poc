// Minimal stand-ins for the @headlessui/react subset this app used
// (Popover, Transition, Dialog). Headless UI + clsx cost ~71 KB of the bundle
// for three simple dropdowns and two modals — too much on the low-end devices
// and slow links this app targets.
//
// Kept: the same import shape and props, click-outside / Escape to close,
// and the enter animation. Dropped: leave animations (elements unmount
// straight away, which is also less work for a weak CPU) and focus trapping.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const cx = (...v) => v.filter(Boolean).join(" ");

/* ─────────────────────────── Transition ─────────────────────────── */

// Applies `enter enterFrom` on mount, then swaps to `enter enterTo` on the
// next frame so the CSS transition runs. `show={false}` renders nothing.
function TransitionImpl({ show = true, enter, enterFrom, enterTo, children }) {
  const [entered, setEntered] = useState(false);

  useLayoutEffect(() => {
    if (!show || !enter) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [show, enter]);

  if (!show) return null;
  if (!enter || !React.isValidElement(children)) return children ?? null;

  return React.cloneElement(children, {
    className: cx(children.props.className, enter, entered ? enterTo : enterFrom),
  });
}

export const Transition = TransitionImpl;
Transition.Child = TransitionImpl;

/* ──────────────────────────── Popover ───────────────────────────── */

const PopoverContext = createContext(null);

export function Popover({ className, children, ...rest }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const ctx = useMemo(() => ({ open, toggle: () => setOpen((v) => !v), close }), [open, close]);

  return (
    <div ref={rootRef} className={className} {...rest}>
      <PopoverContext.Provider value={ctx}>
        {typeof children === "function" ? children({ open, close }) : children}
      </PopoverContext.Provider>
    </div>
  );
}

Popover.Button = function PopoverButton({ onClick, children, ...rest }) {
  const ctx = useContext(PopoverContext);
  return (
    <button
      type="button"
      aria-expanded={!!ctx?.open}
      onClick={(e) => {
        onClick?.(e);
        ctx?.toggle();
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

Popover.Panel = function PopoverPanel({ children, ...rest }) {
  const ctx = useContext(PopoverContext);
  if (!ctx?.open) return null;
  return (
    <div {...rest}>
      {typeof children === "function" ? children({ open: ctx.open, close: ctx.close }) : children}
    </div>
  );
};

/* ───────────────────────────── Dialog ───────────────────────────── */

const DialogContext = createContext(null);

// Portals to <body> so the modal isn't clipped by the meeting's stacking
// contexts — the same place Headless UI rendered it.
export function Dialog({ className, style, onClose, children }) {
  const panelsRef = useRef(new Set());

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Click outside every registered panel closes, matching Headless UI.
  const onMouseDown = (e) => {
    for (const panel of panelsRef.current) {
      if (panel?.contains(e.target)) return;
    }
    onClose?.();
  };

  const ctx = useMemo(
    () => ({
      register: (el) => {
        if (!el) return undefined;
        panelsRef.current.add(el);
        return () => panelsRef.current.delete(el);
      },
    }),
    []
  );

  return createPortal(
    <div className={className} style={style} onMouseDown={onMouseDown}>
      <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
    </div>,
    document.body
  );
}

Dialog.Panel = function DialogPanel({ children, ...rest }) {
  const ctx = useContext(DialogContext);
  const ref = useRef(null);
  useEffect(() => ctx?.register(ref.current), [ctx]);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
};

Dialog.Title = function DialogTitle({ children, ...rest }) {
  return <h2 {...rest}>{children}</h2>;
};
