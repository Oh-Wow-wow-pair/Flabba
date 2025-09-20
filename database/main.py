from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/job_tenure")
async def get_job_tenure():
    return {"job_tenure": "5"}
