# setup guide

## install python 3.11.9 with pyenv

```bash
brew install pyenv
pyenv install 3.11.9
```

## set up project

```bash
cd track-seperation-1
pyenv local 3.11.9
eval "$(pyenv init -)"
```

## create virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

## install requirements

```bash
pip install -r requirements.txt
```

## run the app

```bash
python app.py
```

## notes

- always run `eval "$(pyenv init -)"` in new terminals<br>
- or add it to your shell config file<br>
- the app runs on http://127.0.0.1:5000<br>
- python 3.13 doesn't work with pydub<br>
- soundfile is needed for torchaudio to save wav files 