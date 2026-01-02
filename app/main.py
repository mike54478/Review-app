from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, Field

app = FastAPI(title="Review Request MVP")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    google_place_id: Optional[str] = None


class Business(BusinessCreate):
    id: str
    created_at: datetime


class ContactCreate(BaseModel):
    business_id: str
    first_name: str = Field(..., min_length=1)
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    consent_channel: Optional[str] = Field(
        default=None, description="email or sms"
    )
    consent_source: Optional[str] = None
    consented_at: Optional[datetime] = None


class Contact(ContactCreate):
    id: str
    created_at: datetime


class CampaignCreate(BaseModel):
    business_id: str
    name: str = Field(..., min_length=1)
    channel: str = Field(..., description="email or sms")
    message_template: str = Field(
        ...,
        description="Use {first_name} and {review_link} placeholders",
    )


class Campaign(CampaignCreate):
    id: str
    created_at: datetime


class SendRequest(BaseModel):
    campaign_id: str
    contact_ids: List[str]
    review_link: str


class SendLog(BaseModel):
    id: str
    campaign_id: str
    contact_id: str
    channel: str
    message_preview: str
    status: str
    created_at: datetime


businesses: Dict[str, Business] = {}
contacts: Dict[str, Contact] = {}
campaigns: Dict[str, Campaign] = {}
send_logs: List[SendLog] = []


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/businesses", response_model=Business)
def create_business(payload: BusinessCreate) -> Business:
    business_id = str(uuid4())
    business = Business(
        id=business_id,
        created_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    businesses[business_id] = business
    return business


@app.get("/businesses", response_model=List[Business])
def list_businesses() -> List[Business]:
    return list(businesses.values())


@app.post("/contacts", response_model=Contact)
def create_contact(payload: ContactCreate) -> Contact:
    if payload.business_id not in businesses:
        raise HTTPException(status_code=404, detail="Business not found")
    contact_id = str(uuid4())
    contact = Contact(
        id=contact_id,
        created_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    contacts[contact_id] = contact
    return contact


@app.get("/contacts", response_model=List[Contact])
def list_contacts(business_id: Optional[str] = None) -> List[Contact]:
    items = list(contacts.values())
    if business_id:
        items = [contact for contact in items if contact.business_id == business_id]
    return items


@app.post("/campaigns", response_model=Campaign)
def create_campaign(payload: CampaignCreate) -> Campaign:
    if payload.business_id not in businesses:
        raise HTTPException(status_code=404, detail="Business not found")
    campaign_id = str(uuid4())
    campaign = Campaign(
        id=campaign_id,
        created_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    campaigns[campaign_id] = campaign
    return campaign


@app.get("/campaigns", response_model=List[Campaign])
def list_campaigns(business_id: Optional[str] = None) -> List[Campaign]:
    items = list(campaigns.values())
    if business_id:
        items = [campaign for campaign in items if campaign.business_id == business_id]
    return items


@app.post("/send", response_model=List[SendLog])
def send_review_requests(payload: SendRequest) -> List[SendLog]:
    if payload.campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign = campaigns[payload.campaign_id]
    sent_items: List[SendLog] = []

    for contact_id in payload.contact_ids:
        contact = contacts.get(contact_id)
        if not contact:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        message = campaign.message_template.format(
            first_name=contact.first_name,
            review_link=payload.review_link,
        )
        log = SendLog(
            id=str(uuid4()),
            campaign_id=payload.campaign_id,
            contact_id=contact_id,
            channel=campaign.channel,
            message_preview=message[:160],
            status="queued",
            created_at=datetime.utcnow(),
        )
        send_logs.append(log)
        sent_items.append(log)

    return sent_items


@app.get("/send-logs", response_model=List[SendLog])
def list_send_logs(campaign_id: Optional[str] = None) -> List[SendLog]:
    items = send_logs
    if campaign_id:
        items = [log for log in items if log.campaign_id == campaign_id]
    return items
