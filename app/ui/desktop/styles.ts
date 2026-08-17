import { css } from "remix/ui";

import { desktopColor } from "./theme.ts";

export const desktopControlStyle = {
  button: {
    height: "28px",
    border: `1px solid ${desktopColor.ink}`,
    borderRadius: "3px",
    background: "linear-gradient(#fff, #d9e1e4)",
    color: desktopColor.ink,
    boxShadow: "0 1px #fff inset",
    font: "inherit",
    cursor: "pointer",
    "&:focus-visible": {
      outline: `2px solid ${desktopColor.accent}`,
      outlineOffset: "2px",
    },
    "&:disabled": {
      opacity: 0.42,
      cursor: "not-allowed",
    },
  },
  range: {
    appearance: "none",
    height: "18px",
    background: "transparent",
    "&::-webkit-slider-runnable-track": {
      height: "14px",
      border: `1px solid ${desktopColor.line}`,
      background: `repeating-linear-gradient(90deg, #fff, #fff 8px, ${desktopColor.wash} 8px, ${desktopColor.wash} 10px)`,
    },
    "&::-webkit-slider-thumb": {
      appearance: "none",
      width: "14px",
      height: "18px",
      marginTop: "-4px",
      border: `1px solid ${desktopColor.ink}`,
      background: desktopColor.accent,
    },
    "&::-moz-range-track": {
      height: "14px",
      border: `1px solid ${desktopColor.line}`,
      background: `repeating-linear-gradient(90deg, #fff, #fff 8px, ${desktopColor.wash} 8px, ${desktopColor.wash} 10px)`,
    },
    "&::-moz-range-thumb": {
      width: "14px",
      height: "18px",
      border: `1px solid ${desktopColor.ink}`,
      borderRadius: 0,
      background: desktopColor.accent,
    },
    "&:focus-visible": {
      outline: `2px solid ${desktopColor.accent}`,
      outlineOffset: "2px",
    },
  },
} as const;

export const desktopStyle = {
  window: css({
    color: desktopColor.ink,
    background: `repeating-linear-gradient(${desktopColor.wash}, ${desktopColor.wash} 2px, ${desktopColor.stripe} 2px, ${desktopColor.stripe} 4px)`,
    border: `1px solid ${desktopColor.ink}`,
    borderRadius: "6px",
    boxShadow: "0 0 0 1px #fff inset, 0 18px 50px rgba(15, 24, 28, 0.18)",
    overflow: "hidden",
    fontSize: "14px",
    lineHeight: "20px",
  }),
  titleBar: css({
    minHeight: "28px",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    color: "#fff",
    background: "linear-gradient(#6d777c, #4d575d)",
    borderBottom: `1px solid ${desktopColor.ink}`,
    textShadow: "0 1px #000",
  }),
  panel: css({
    background: desktopColor.paper,
    border: `1px solid ${desktopColor.line}`,
    boxShadow: "0 0 0 1px #fff inset",
  }),
  messageCard: css({
    background: desktopColor.paper,
    border: `1px solid ${desktopColor.line}`,
    boxShadow: "0 0 0 1px #fff inset",
    padding: "10px",
  }),
  messageLabel: css({
    display: "inline-grid",
    alignItems: "center",
    minWidth: "72px",
    minHeight: "23px",
    margin: "-1px 0 6px -1px",
    padding: "0 8px",
    background: desktopColor.accentSoft,
    border: `1px solid ${desktopColor.line}`,
    color: "#16333a",
  }),
  primaryButton: css({
    ...desktopControlStyle.button,
    background: `linear-gradient(${desktopColor.accentSoft}, #9fdde6)`,
  }),
  input: css({
    width: "100%",
    minWidth: 0,
    height: "28px",
    border: `1px solid ${desktopColor.ink}`,
    borderRadius: "3px",
    background: desktopColor.paper,
    color: desktopColor.ink,
    padding: "0 8px",
    font: "inherit",
    "&:focus-visible": {
      outline: `2px solid ${desktopColor.accent}`,
      outlineOffset: "2px",
    },
  }),
  visuallyHidden: css({
    position: "absolute",
    width: "1px",
    height: "1px",
    opacity: 0,
    pointerEvents: "none",
  }),
} as const;
