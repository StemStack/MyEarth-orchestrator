# Run locally

cd ~/dev/0_Code/repo/MyEarth_repo/MyEarth1.0
source ../_venv_MyEarth/bin/activate
python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 5003
