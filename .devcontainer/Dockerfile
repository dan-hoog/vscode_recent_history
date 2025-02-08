FROM ubuntu:22.04

RUN apt update \
    && apt upgrade -y \
    && apt-get install -y software-properties-common git

RUN apt install sudo

# Create ubuntu user
RUN useradd -rm -d /home/ubuntu -p "$(openssl passwd -1 ubuntu)" -s /bin/bash -g root -G sudo -u 1001 ubuntu \
    && usermod -aG sudo ubuntu

RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> \
    /etc/sudoers

SHELL ["/bin/bash", "--login", "-i", "-c"]

# Make the local bin directory writeable by the ubuntu user
RUN chown -R ubuntu /usr/local/bin /home/ubuntu/

# Change to non-root user to install everything else
USER ubuntu
WORKDIR /home/ubuntu

# Install pyenv
RUN git clone https://github.com/pyenv/pyenv.git ~/.pyenv

RUN echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
RUN echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
RUN echo -e 'if command -v pyenv 1>/dev/null 2>&1; then\n  eval "$(pyenv init -)"\nfi' >> ~/.bashrc
RUN sudo apt install -y gcc zlib1g-dev bzip2 libbz2-dev libreadline-dev sqlite libsqlite3-dev libssl-dev libffi-dev vim tar curl wget make python3-dev

# Needs regular bash shell for things like pushd and popd
RUN bash -xc "pyenv install 3.13; \
              pyenv global 3.13"

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
ENV PATH $HOME/.local/bin:$PATH
RUN poetry --version

# Install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

RUN echo 'export PATH="/workspaces/hatcher-score-backend/src/.venv/bin:/workspaces/client/node_modules/bin:$PATH"' >> ~/.bashrc
RUN echo "alias l.='ls -d .* --color=auto'" >> ~/.bashrc
RUN echo "alias ls='ls --color=auto'" >> ~/.bashrc
RUN echo "alias ll='ls -la'" >> ~/.bashrc
RUN echo "alias grep='grep --color=auto'" >> ~/.bashrc
RUN echo "source /usr/share/bash-completion/completions/git" >> ~/.bashrc
RUN echo "export NVM_DIR=\"${HOME}/.nvm\"" >> ~/.bashrc
RUN echo "[ -s \"$NVM_DIR/nvm.sh\" ] && \. \"$NVM_DIR/nvm.sh\" # This loads nvm" >> ~/.bashrc

