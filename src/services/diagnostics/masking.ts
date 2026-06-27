export function maskUserId(id: string | null | undefined) {
  if (!id) {
    return "Unavailable";
  }

  if (id.length <= 10) {
    return `${id.slice(0, 3)}...${id.slice(-2)}`;
  }

  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

export function maskUrl(url: string | null | undefined) {
  if (!url) {
    return "Not configured";
  }

  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
}

export function maskToken(token: string | null | undefined) {
  if (!token) {
    return "Missing";
  }

  if (token.length <= 8) {
    return "Configured";
  }

  return `${token.slice(0, 2)}***${token.slice(-2)}`;
}
