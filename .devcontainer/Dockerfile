FROM mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie

ARG DEBIAN_FRONTEND=noninteractive
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=${PNPM_HOME}/bin:${PATH}
ENV IN_DEV_CONTAINER=1

COPY .devcontainer/ /tmp/.devcontainer/
RUN if [ -x /tmp/.devcontainer/bootstrap/bootstrap.sh ]; then \
		/tmp/.devcontainer/bootstrap/bootstrap.sh; \
	fi \
	&& rm -rf /tmp/.devcontainer

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		vim \
		git \
		mkcert \
		libnss3-tools \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable \
	&& corepack prepare pnpm@latest --activate
