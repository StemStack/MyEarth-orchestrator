# MyEarth – Setup & Run Guide

## Local Development Setup

### Prerequisites
- Python 3.9 or higher
- PostgreSQL database (optional, app will start without it)
- Virtual environment located at `../_venv_MyEarth` (outside the repository)

### Setup Steps

1. **Clone the Repository**
```bash
git clone https://github.com/StemStack/MyEarth.git
cd MyEarth
```

2. **Create or Recreate Virtual Environment** (if needed)
```bash
python3 -m venv ../_venv_MyEarth
```

3. **Activate Virtual Environment**
```bash
source ../_venv_MyEarth/bin/activate
```

4. **Install Dependencies**
```bash
python3 -m pip install -r requirements.txt
```

5. **Start the Application**
```bash
python3 -m uvicorn main:app --reload --port 5001
```

The application will be available at `http://localhost:5001`

**Note:** Using `python3 -m pip` and `python3 -m uvicorn` ensures these commands work even if `pip` or `uvicorn` are not on your PATH.

### Optional: Database Setup

If you want to use the database features, configure your PostgreSQL connection in a `.env` file:

```bash
DB_NAME=myearth
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

Then initialize the database:
```bash
python init_db.py
```
