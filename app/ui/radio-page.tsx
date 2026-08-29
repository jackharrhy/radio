import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import { RadioRoom } from "../assets/radio-room.tsx";
import type { RoomSnapshot } from "../data/protocol.ts";
import { desktopColor, desktopThemeStyle } from "./desktop/theme.ts";
import { Document } from "./document.tsx";

export function RadioPage(handle: Handle<{ snapshot: RoomSnapshot }>) {
  return () => (
    <Document title="Radio" head={<RadioHead />}>
      <main mix={[desktopThemeStyle, pageStyle]}>
        <RadioRoom initialSnapshot={handle.props.snapshot} />
      </main>
    </Document>
  );
}

function RadioHead() {
  return () => (
    <>
      <meta name="color-scheme" content="light" />
      <meta name="description" content="A cozy shared room radio." />
    </>
  );
}

const pageStyle = css({
  minHeight: "100vh",
  background: `radial-gradient(circle at 50% 18%, color-mix(in oklab, ${desktopColor.accent}, transparent 70%), transparent 34rem), #d6d6d6`,
  padding: "16px",
  boxSizing: "border-box",
  display: "grid",
  placeItems: "center",
  "@media (max-width: 720px)": {
    padding: "8px",
  },
});
