from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import HealthResponse
from app.routers import auth, faq, rehearsal, repos

app = FastAPI(title="Migration Rehearsal Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(repos.router, prefix="/api")
app.include_router(rehearsal.router, prefix="/api")
app.include_router(faq.router, prefix="/api")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", phase="1")