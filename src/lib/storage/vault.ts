const secrets = new Map<string, string>();

export function setVaultSecret(id: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    secrets.delete(id);
    return false;
  }
  secrets.set(id, trimmed);
  return true;
}

export function getVaultSecret(id: string): string | undefined {
  return secrets.get(id);
}

export function clearVaultSecret(id: string) {
  secrets.delete(id);
}

export function vaultHas(id: string): boolean {
  return secrets.has(id);
}
