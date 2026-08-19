export function getWsUrl(): string {
  let { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
}

export function getTrackCreateUrl(): string {
  return "/tracks";
}

export function getTrackContentUrl(trackId: string): string {
  return `/tracks/${encodeURIComponent(trackId)}/content`;
}
