import { useEffect } from "react";
import { useStore } from "../store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const state = useStore.getState();
      const shift = e.shiftKey;
      const cmd = e.metaKey || e.ctrlKey;

      // Undo / redo for mapping work. Cmd-Z / Ctrl-Z = undo;
      // Cmd-Shift-Z or Cmd-Y = redo. Caught here (not in the switch
      // below) because it's a chord, not a single key.
      if (cmd && e.code === "KeyZ") {
        e.preventDefault();
        if (shift) state.redo(); else state.undo();
        return;
      }
      if (cmd && e.code === "KeyY") {
        e.preventDefault();
        state.redo();
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          state.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          state.setCurrentFrame(Math.max(0, state.currentFrame - (shift ? 10 : 1)));
          break;
        case "ArrowRight":
          e.preventDefault();
          state.setCurrentFrame(Math.min(state.acmNumFrames - 1, state.currentFrame + (shift ? 10 : 1)));
          break;
        case "Home":
          e.preventDefault();
          state.setCurrentFrame(0);
          break;
        case "End":
          e.preventDefault();
          state.setCurrentFrame(Math.max(0, state.acmNumFrames - 1));
          break;
        case "Digit1":
          state.setMode("mapping");
          break;
        case "Digit2":
          state.setMode("offset");
          break;
        case "Escape":
          state.setSelectedKeypoint(null);
          break;
        case "KeyL":
          state.labelCurrentFrame();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
