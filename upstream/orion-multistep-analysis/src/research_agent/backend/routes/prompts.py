"""Prompt template management routes."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from ..prompts import (
    PromptTemplate,
    delete_template,
    duplicate_template,
    list_templates,
    set_template_archived,
    update_template,
)

router = APIRouter()


class PromptTemplateResponse(BaseModel):
    id: str
    name: str
    role: str
    content: str
    source: str
    locked: bool
    archived: bool

    @classmethod
    def from_template(cls, template: PromptTemplate) -> "PromptTemplateResponse":
        return cls(
            id=template.id,
            name=template.name,
            role=template.role,
            content=template.content,
            source=template.source,
            locked=template.locked,
            archived=template.archived,
        )


class PromptDuplicateRequest(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None


class PromptUpdateRequest(BaseModel):
    name: str
    content: str


@router.get("/", response_model=List[PromptTemplateResponse])
def list_prompt_templates() -> List[PromptTemplateResponse]:
    return [PromptTemplateResponse.from_template(t) for t in list_templates()]


@router.post("/{prompt_id}/duplicate", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
def duplicate_prompt(prompt_id: str, payload: PromptDuplicateRequest) -> PromptTemplateResponse:
    try:
        template = duplicate_template(prompt_id, payload.name, payload.content)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    return PromptTemplateResponse.from_template(template)


@router.put("/{prompt_id}", response_model=PromptTemplateResponse)
def update_prompt_template(prompt_id: str, payload: PromptUpdateRequest) -> PromptTemplateResponse:
    try:
        template = update_template(prompt_id, payload.name, payload.content)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found or not editable")
    return PromptTemplateResponse.from_template(template)


@router.post("/{prompt_id}/archive", response_model=PromptTemplateResponse)
def archive_prompt_template(prompt_id: str) -> PromptTemplateResponse:
    try:
        template = set_template_archived(prompt_id, True)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found or not archivable")
    return PromptTemplateResponse.from_template(template)


@router.post("/{prompt_id}/unarchive", response_model=PromptTemplateResponse)
def unarchive_prompt_template(prompt_id: str) -> PromptTemplateResponse:
    try:
        template = set_template_archived(prompt_id, False)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found or not archivable")
    return PromptTemplateResponse.from_template(template)


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_prompt_template(prompt_id: str) -> Response:
    try:
        delete_template(prompt_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found or not deletable")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
