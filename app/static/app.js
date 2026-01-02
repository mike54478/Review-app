const api = (path, options = {}) =>
  fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Request failed");
    }
    return data;
  });

const businessForm = document.querySelector("#business-form");
const contactForm = document.querySelector("#contact-form");
const campaignForm = document.querySelector("#campaign-form");
const sendForm = document.querySelector("#send-form");

const businessStatus = document.querySelector("#business-status");
const contactStatus = document.querySelector("#contact-status");
const campaignStatus = document.querySelector("#campaign-status");
const sendStatus = document.querySelector("#send-status");

const contactBusinessSelect = document.querySelector("#contact-business");
const campaignBusinessSelect = document.querySelector("#campaign-business");
const sendCampaignSelect = document.querySelector("#send-campaign");
const sendContactsSelect = document.querySelector("#send-contacts");
const sendLogsList = document.querySelector("#send-logs");
const refreshLogsButton = document.querySelector("#refresh-logs");

const setStatus = (element, message, isError = false) => {
  element.textContent = message;
  element.className = `status ${isError ? "error" : "success"}`;
};

const resetStatus = (element) => {
  element.textContent = "";
  element.className = "status";
};

const fillSelect = (select, items, formatter) => {
  select.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = formatter(item);
    select.append(option);
  });
};

const refreshBusinesses = async () => {
  const businesses = await api("/businesses");
  fillSelect(contactBusinessSelect, businesses, (b) => b.name);
  fillSelect(campaignBusinessSelect, businesses, (b) => b.name);
};

const refreshContacts = async () => {
  const contacts = await api("/contacts");
  fillSelect(sendContactsSelect, contacts, (c) => `${c.first_name} ${c.last_name || ""}`.trim());
};

const refreshCampaigns = async () => {
  const campaigns = await api("/campaigns");
  fillSelect(sendCampaignSelect, campaigns, (c) => `${c.name} (${c.channel})`);
};

const refreshLogs = async () => {
  const logs = await api("/send-logs");
  sendLogsList.innerHTML = "";
  logs.slice().reverse().forEach((log) => {
    const item = document.createElement("li");
    item.textContent = `${log.channel.toUpperCase()} | ${log.message_preview} | ${log.status}`;
    sendLogsList.append(item);
  });
};

businessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus(businessStatus);
  const formData = new FormData(businessForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api("/businesses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(businessStatus, "Business created.");
    businessForm.reset();
    await refreshBusinesses();
  } catch (error) {
    setStatus(businessStatus, error.message, true);
  }
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus(contactStatus);
  const formData = new FormData(contactForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.business_id) {
    setStatus(contactStatus, "Select a business first.", true);
    return;
  }
  if (!payload.email) delete payload.email;
  if (!payload.phone) delete payload.phone;
  if (!payload.last_name) delete payload.last_name;
  if (!payload.consent_channel) delete payload.consent_channel;
  if (!payload.consent_source) delete payload.consent_source;
  if (!payload.consented_at) delete payload.consented_at;

  try {
    await api("/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(contactStatus, "Contact added.");
    contactForm.reset();
    await refreshContacts();
  } catch (error) {
    setStatus(contactStatus, error.message, true);
  }
});

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus(campaignStatus);
  const formData = new FormData(campaignForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.business_id) {
    setStatus(campaignStatus, "Select a business first.", true);
    return;
  }

  try {
    await api("/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(campaignStatus, "Campaign created.");
    campaignForm.reset();
    await refreshCampaigns();
  } catch (error) {
    setStatus(campaignStatus, error.message, true);
  }
});

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus(sendStatus);
  const formData = new FormData(sendForm);
  const payload = Object.fromEntries(formData.entries());
  const selectedContacts = Array.from(sendContactsSelect.selectedOptions).map(
    (option) => option.value
  );
  payload.contact_ids = selectedContacts;
  if (!payload.campaign_id) {
    setStatus(sendStatus, "Select a campaign.", true);
    return;
  }
  if (!payload.contact_ids.length) {
    setStatus(sendStatus, "Select at least one contact.", true);
    return;
  }

  try {
    await api("/send", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus(sendStatus, "Send queued.");
    sendForm.reset();
    await refreshLogs();
  } catch (error) {
    setStatus(sendStatus, error.message, true);
  }
});

refreshLogsButton.addEventListener("click", refreshLogs);

const bootstrap = async () => {
  await refreshBusinesses();
  await refreshContacts();
  await refreshCampaigns();
  await refreshLogs();
};

bootstrap();
