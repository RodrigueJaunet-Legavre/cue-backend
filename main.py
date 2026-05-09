from fastapi.middleware.cors import CORSMiddleware
import os, time, json, stripe
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

load_dotenv()

app = FastAPI(title="CUE Backend", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://cuedj.eu")
COMMISSION_RATES = {"starter": 0.07, "pro": 0.03, "business": 0.00}

RATE_WINDOW = 30
RATE_MAX = 20
_hits = {}

def rate_limit(ip: str):
    now = time.time()
    arr = [t for t in _hits.get(ip, []) if now - t < RATE_WINDOW]
    if len(arr) >= RATE_MAX:
        raise HTTPException(status_code=429, detail="Too many requests.")
    arr.append(now)
    _hits[ip] = arr

FAQ_PATH = "faq_seed.json"

def load_faq():
    try:
        with open(FAQ_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return [{"id": it.get("id", f"FAQ-{i+1:03d}"), "q": it.get("q",""), "a": it.get("a",""), "variants": it.get("variants",[])} for i, it in enumerate(data["items"])]
        if isinstance(data, list):
            return [{"id": f"QNA-{i+1:03d}", "q": it.get("question",""), "a": it.get("long_answer") or it.get("short_answer",""), "variants": it.get("variants",[])} for i, it in enumerate(data)]
        return []
    except FileNotFoundError:
        return []

FAQ_ITEMS = load_faq()

def search_faq(question, items, top_k=3):
    q_words = set(w.strip(".,!?;:()[]").lower() for w in question.split() if len(w) > 2)
    scored = [(sum(1 for w in q_words if w in (item.get("q","") + " " + " ".join(item.get("variants",[])) + " " + item.get("a","")).lower()), item) for item in items]
    scored = [(s, i) for s, i in scored if s > 0]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [i for _, i in scored[:top_k]]

class ChatIn(BaseModel):
    message: str
class ChatOut(BaseModel):
    reply: str
    sources: list = []
    escalation: bool = False
class MatchIn(BaseModel):
    type: str
    vibe: str = "Non precis"
    budget: str
    city: str = "Non precisee"
    details: str = "Aucun"
class ContractIn(BaseModel):
    dj: str
    venue: str
    date: str = ""
    start: str = "23:00"
    end: str = "05:00"
    fee: float = 0
    rider: str = ""
    clauses: str = ""
class BookingPaymentIn(BaseModel):
    booking_id: str
    dj_name: str
    venue_name: str
    event_date: str
    total_fee: float
    dj_plan: str = "starter"
class ValidateBookingIn(BaseModel):
    booking_id: str
    payment_intent_id: str
class RefundBookingIn(BaseModel):
    booking_id: str
    payment_intent_id: str
    reason: str = "Manquement au contrat"

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/chat", response_model=ChatOut)
async def chat(payload: ChatIn, request: Request):
    rate_limit(request.client.host if request.client else "unknown")
    msg = payload.message.strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Empty message.")
    matches = search_faq(msg, FAQ_ITEMS)
    if matches:
        return ChatOut(reply="\n\n---\n\n".join([f"Q: {m['q']}\nA: {m['a']}" for m in matches]), sources=[m["id"] for m in matches])
    return ChatOut(reply="Contactez-nous : cue.dj.app@gmail.com", sources=[], escalation=True)

@app.post("/match")
async def match(payload: MatchIn, request: Request):
    rate_limit(request.client.host if request.client else "unknown")
    prompt = f"Tu es expert en booking DJ. Recommande 3 profils DJ fictifs.\nType:{payload.type}\nVibe:{payload.vibe}\nBudget:{payload.budget}\nVille:{payload.city}\nDetails:{payload.details}\nRetourne EXACTEMENT ce JSON sans markdown:[{{\"name\":\"DJ Nom\",\"match\":95,\"tags\":[\"House\"],\"price\":\"400\",\"bio\":\"Bio.\"}}]"
    try:
        msg = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=800, system="Reponds uniquement en JSON valide, sans markdown.", messages=[{"role":"user","content":prompt}])
        return {"djs": json.loads(msg.content[0].text.strip().replace("```json","").replace("```","").strip())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contract")
async def contract(payload: ContractIn, request: Request):
    rate_limit(request.client.host if request.client else "unknown")
    if not payload.dj or not payload.venue:
        raise HTTPException(status_code=400, detail="Nom DJ et Venue requis.")
    deposit = round(payload.fee * 0.5 * 100) / 100
    balance = round((payload.fee - deposit) * 100) / 100
    prompt = f"Genere un contrat DJ professionnel en francais avec sections ###SECTION_N: TITRE###\nDJ:{payload.dj}|Venue:{payload.venue}|Date:{payload.date or 'A confirmer'}|Horaires:{payload.start}->{payload.end}|Cachet:{payload.fee}EUR|Acompte:{deposit}EUR|Solde:{balance}EUR|Rider:{payload.rider or 'Standard'}|Clauses:{payload.clauses or 'Aucune'}"
    try:
        msg = client.messages.create(model="claude-sonnet-4-20250514", max_tokens=3000, system="Expert juridique contrats artistiques France.", messages=[{"role":"user","content":prompt}])
        return {"contract_text": msg.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/payments/booking")
async def create_booking_payment(payload: BookingPaymentIn):
    amount_cents = round(payload.total_fee * 100)
    commission_rate = COMMISSION_RATES.get(payload.dj_plan, 0.07)
    commission = round(payload.total_fee * commission_rate * 100) / 100
    dj_payout = round((payload.total_fee - commission) * 100) / 100
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[{"price_data": {"currency": "eur", "unit_amount": amount_cents, "product_data": {"name": f"Booking DJ {payload.dj_name}", "description": f"{payload.venue_name} - {payload.event_date}"}}, "quantity": 1}],
            payment_intent_data={"capture_method": "automatic", "metadata": {"booking_id": payload.booking_id, "dj_name": payload.dj_name, "venue_name": payload.venue_name, "total_fee": str(payload.total_fee), "commission": str(commission), "dj_payout": str(dj_payout), "status": "held"}},
            metadata={"booking_id": payload.booking_id},
            success_url=f"{FRONTEND_URL}/booking/{payload.booking_id}?payment=success",
            cancel_url=f"{FRONTEND_URL}/booking/{payload.booking_id}?payment=cancelled",
        )
        return {"checkout_url": session.url, "session_id": session.id, "summary": {"total_charged": payload.total_fee, "commission_cue": commission, "dj_will_receive": dj_payout}}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/payments/validate")
async def validate_and_pay_dj(payload: ValidateBookingIn):
    try:
        pi = stripe.PaymentIntent.retrieve(payload.payment_intent_id)
        meta = pi.get("metadata", {})
        if meta.get("status") == "refunded":
            raise HTTPException(status_code=400, detail="Deja rembourse.")
        if meta.get("status") == "validated":
            raise HTTPException(status_code=400, detail="Deja valide.")
        dj_payout = float(meta.get("dj_payout", 0))
        stripe.PaymentIntent.modify(payload.payment_intent_id, metadata={"status": "validated"})
        return {"success": True, "booking_id": payload.booking_id, "dj_payout": dj_payout}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/payments/refund")
async def refund_booking(payload: RefundBookingIn):
    try:
        pi = stripe.PaymentIntent.retrieve(payload.payment_intent_id)
        meta = pi.get("metadata", {})
        if meta.get("status") == "validated":
            raise HTTPException(status_code=400, detail="Performance deja validee.")
        if meta.get("status") == "refunded":
            raise HTTPException(status_code=400, detail="Deja rembourse.")
        refund = stripe.Refund.create(payment_intent=payload.payment_intent_id)
        stripe.PaymentIntent.modify(payload.payment_intent_id, metadata={"status": "refunded"})
        return {"success": True, "refund_id": refund.id, "amount_refunded": refund.amount / 100}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if event["type"] == "checkout.session.completed":
        print(f"Paiement recu - booking: {event['data']['object'].get('metadata',{}).get('booking_id')}")
    elif event["type"] == "charge.refunded":
        print(f"Remboursement - booking: {event['data']['object'].get('metadata',{}).get('booking_id')}")
    return {"received": True}


