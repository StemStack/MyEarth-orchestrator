from fastapi import FastAPI
from routers import data

app = FastAPI()

app.include_router(data.router, prefix="/data", tags=["data"])

@app.get("/")
def read_root():
    return {"message": "Welcome to MyEarth API"}

