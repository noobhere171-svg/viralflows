import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: async () => false,
});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      resolveRef.current = res;
      setState(options);
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setState(null);
    resolveRef.current = null;
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setState(null);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={handleCancel}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-lg mb-2">{state.title}</h3>
            <p className="text-zinc-400 text-sm mb-6">{state.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancel}
                className="px-4 py-2 bg-[#0f0f0f] border border-[#2a2a2a] text-zinc-300 rounded-lg text-sm hover:bg-white/5">
                {state.cancelLabel || "Cancel"}
              </button>
              <button onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${state.variant === "danger" ? "bg-red-600 text-white hover:bg-red-700" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                {state.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}
