#!/usr/bin/env bash
set -euo pipefail

printf 'setup-dev: running with user: %s\n' "${USER}" >&2

printf 'setup-dev: node version: %s\n' "$(node --version)" >&2
printf 'setup-dev: pnpm version: %s\n' "$(pnpm --version)" >&2

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf 'setup-dev: project root: %s\n' "${project_root}" >&2

ensure_certs() {
	local cert_dir="${project_root}/certs"
	local cert_file="${cert_dir}/cert.pem"
	local key_file="${cert_dir}/key.pem"
	local ca_root

	mkdir -p "${cert_dir}"

	if [[ -f "${cert_file}" && -f "${key_file}" ]]; then
		printf 'setup-dev: certs in %s are complete; skipping generation\n' "${cert_dir}" >&2
		return 0
	fi

	if [[ -e "${cert_file}" || -e "${key_file}" ]]; then
		printf 'setup-dev: certs in %s are incomplete; not overwriting existing files\n' "${cert_dir}" >&2
		return 0
	fi

	if ! command -v mkcert >/dev/null 2>&1; then
		printf 'setup-dev: mkcert not found; skipping cert generation\n' >&2
		return 0
	fi

	printf 'setup-dev: generating certs in %s\n' "${cert_dir}" >&2
	ca_root="$(mkcert -CAROOT)"
	if [[ ! -f "${ca_root}/rootCA.pem" ]]; then
		printf 'setup-dev: installing root CA\n' >&2
		mkcert -install
	fi

	mkcert -key-file "${key_file}" -cert-file "${cert_file}" localhost 127.0.0.1 ::1

	ln -sf "${ca_root}/rootCA.pem" "${cert_dir}/rootCA.pem"
}

ensure_certs

pnpm install --global --ignore-scripts docsify-cli@5.0.0

pnpm install --dir "${project_root}" -y
