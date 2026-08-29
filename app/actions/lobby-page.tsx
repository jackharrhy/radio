import type { Handle } from "remix/ui";
import { css } from "remix/ui";

import type { RoomRecord } from "../data/radio-runtime.ts";
import type { RadioIdentity } from "../middleware/access.ts";
import { routes } from "../routes.ts";
import { desktopColor, desktopThemeStyle } from "../ui/desktop/theme.ts";
import { desktopStyle } from "../ui/desktop/styles.ts";
import { Document } from "../ui/document.tsx";

export function LobbyPage(
  handle: Handle<{
    rooms: RoomRecord[];
    identity: RadioIdentity | null;
    selectedRoom: string;
    message?: string;
  }>,
) {
  return () => {
    let { rooms, identity, selectedRoom, message } = handle.props;
    return (
      <Document title="Radio rooms">
        <main mix={[desktopThemeStyle, lobbyStyle.page]}>
          <section mix={[desktopStyle.window, lobbyStyle.window]}>
            <div mix={desktopStyle.titleBar} aria-hidden="true"></div>

            <div mix={lobbyStyle.body}>
              {message ? (
                <p role="alert" mix={lobbyStyle.message}>
                  {message}
                </p>
              ) : null}

              <form
                method="post"
                action={routes.join.href()}
                data-authenticated={identity ? "true" : "false"}
                mix={lobbyStyle.form}
              >
                <fieldset mix={lobbyStyle.rooms}>
                  <legend mix={lobbyStyle.legend}>available rooms</legend>
                  {rooms.map((room) => (
                    <label key={room.slug} aria-label={`Join ${room.name}`} mix={lobbyStyle.room}>
                      <input
                        type="radio"
                        name="roomSlug"
                        value={room.slug}
                        checked={room.slug === selectedRoom}
                        required={true}
                      />
                      <span>
                        <strong>{room.name}</strong>
                        <small>/{room.slug}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <label mix={lobbyStyle.field}>
                  <span>your name</span>
                  <input
                    mix={desktopStyle.input}
                    name="name"
                    type="text"
                    autocomplete="name"
                    value={identity?.name ?? ""}
                    maxlength={40}
                    required={true}
                  />
                </label>
                {!identity ? (
                  <label mix={lobbyStyle.field}>
                    <span>password</span>
                    <input
                      mix={desktopStyle.input}
                      name="password"
                      type="password"
                      autocomplete="current-password"
                      maxlength={256}
                      required={true}
                    />
                  </label>
                ) : null}
                <button mix={[desktopStyle.primaryButton, lobbyStyle.joinButton]} type="submit">
                  tune in
                </button>
              </form>

              {identity ? (
                <section mix={[desktopStyle.panel, lobbyStyle.createPanel]}>
                  <h2>start a room</h2>
                  <p>A new room starts with its own empty queue.</p>
                  <form
                    method="post"
                    action={routes.rooms.create.href()}
                    mix={lobbyStyle.createForm}
                  >
                    <label mix={lobbyStyle.field}>
                      <span>room name</span>
                      <input mix={desktopStyle.input} name="name" maxlength={48} required={true} />
                    </label>
                    <label mix={lobbyStyle.field}>
                      <span>address</span>
                      <input
                        mix={desktopStyle.input}
                        name="slug"
                        placeholder="late-night"
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        maxlength={40}
                        required={true}
                      />
                    </label>
                    <button mix={desktopStyle.primaryButton} type="submit">
                      create room
                    </button>
                  </form>
                </section>
              ) : null}

              {identity ? (
                <form method="post" action={routes.logout.href()} mix={lobbyStyle.signOutForm}>
                  <button mix={desktopStyle.smallButton} type="submit">
                    sign out
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        </main>
      </Document>
    );
  };
}

const lobbyStyle = {
  page: css({
    minHeight: "100dvh",
    boxSizing: "border-box",
    padding: "clamp(12px, 4vw, 52px)",
    display: "grid",
    placeItems: "center",
    background: `radial-gradient(circle at 50% 12%, ${desktopColor.accentSoft}, transparent 28rem), #d6d6d6`,
  }),
  window: css({ width: "min(760px, 100%)" }),
  body: css({ display: "grid", gap: "14px", padding: "clamp(20px, 4vw, 32px)" }),
  message: css({
    margin: 0,
    padding: "10px",
    background: "#fff3cd",
    border: `1px solid ${desktopColor.line}`,
  }),
  form: css({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: "12px",
    padding: "14px",
    background: desktopColor.paper,
    border: `1px solid ${desktopColor.line}`,
    boxShadow: "0 0 0 1px #fff inset",
    "& > fieldset": { gridColumn: "1 / -1" },
    '&[data-authenticated="true"]': { gridTemplateColumns: "minmax(0, 1fr) auto" },
    "@media (max-width: 620px)": {
      gridTemplateColumns: "1fr",
      '&[data-authenticated="true"]': { gridTemplateColumns: "1fr" },
      "& > button": { width: "100%" },
    },
  }),
  rooms: css({
    border: 0,
    padding: 0,
    margin: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px",
  }),
  legend: css({
    padding: "0 0 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  }),
  room: css({
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "11px",
    cursor: "pointer",
    background: desktopColor.paper,
    border: `1px solid ${desktopColor.line}`,
    transition: "background 120ms ease, box-shadow 120ms ease",
    "&:hover": { background: desktopColor.wash },
    "&:focus-within": { outline: `2px solid ${desktopColor.accent}`, outlineOffset: "2px" },
    "&:has(input:checked)": {
      background: desktopColor.accentSoft,
      borderColor: desktopColor.ink,
      boxShadow: `3px 0 0 ${desktopColor.accent} inset`,
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
    "& input": { accentColor: desktopColor.accent },
    "& span": { display: "grid" },
    "& small": { color: "#59666d" },
  }),
  field: css({
    minWidth: 0,
    display: "grid",
    gap: "4px",
    "& > span": { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" },
  }),
  joinButton: css({
    minWidth: "112px",
    alignSelf: "end",
    "&:active": { transform: "translateY(1px)" },
  }),
  createPanel: css({
    padding: "16px",
    "& h2": { margin: 0, fontSize: "18px", lineHeight: 1.1 },
    "& p": { margin: "5px 0 14px", color: "#445159" },
  }),
  createForm: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    alignItems: "end",
    gap: "10px",
    "@media (max-width: 620px)": { gridTemplateColumns: "1fr" },
  }),
  signOutForm: css({ justifySelf: "end" }),
};
