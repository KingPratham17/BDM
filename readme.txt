# Business Document Management (BDM) Backend

A fully automated AI-powered document generation system that creates professional business documents with clauses, templates, and PDF export capabilities.

## 🚀 Features

- **AI-Powered Clause Generation**: Automatically generate document clauses using OpenAI
- **Automated Template Creation**: AI assembles clauses into professional templates
- **Document Generation**: Create complete documents with dynamic data filling
- **MySQL Database**: Persistent storage for clauses, templates, and documents
- **RESTful API**: Clean API endpoints for all operations
- **PDF Export Ready**: Structure ready for PDF generation

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- OpenAI API Key

## 🛠️ Installation

### 1. Clone or Create Project

```bash
mkdir bdm-backend
cd bdm-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup MySQL Database

Login to MySQL:
```bash
mysql -u root -p
```

Run the database schema:
```bash
mysql -u root -p < database.sql
```

Or manually copy and execute the SQL from `database.sql` file.

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bdm_system
DB_PORT=3306

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Get OpenAI API Key**: https://platform.openai.com/api-keys

### 5. Start the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will start at: `http://localhost:5000`

## 📚 API Endpoints

### Documents

#### Generate Document (Fully Automated AI)
```http
POST /api/documents/generate-document
Content-Type: application/json

{
  "document_type": "offer_letter",
  "document_name": "Senior_Developer_Offer",
  "context": {
    "company_name": "Tech Corp",
    "candidate_name": "John Doe",
    "position": "Senior Software Engineer",
    "salary": "$120,000",
    "start_date": "January 15, 2026",
    "department": "Engineering",
    "reporting_to": "CTO"
  }
}
```

#### Get All Documents
```http
GET /api/documents
GET /api/documents?document_type=offer_letter
```

#### Get Document by ID
```http
GET /api/documents/:id
```

#### Update Document
```http
PUT /api/documents/:id
Content-Type: application/json

{
  "document_name": "Updated Name"
}
```

#### Delete Document
```http
DELETE /api/documents/:id
```

### Clauses

#### Get All Clauses
```http
GET /api/clauses
GET /api/clauses?category=offer_letter
GET /api/clauses?clause_type=header
```

#### Get Clause by ID
```http
GET /api/clauses/:id
```

#### Create Clause (Manual)
```http
POST /api/clauses
Content-Type: application/json

{
  "clause_type": "header",
  "content": "COMPANY LETTERHEAD\n[Company Name]",
  "category": "offer_letter"
}
```

#### Update Clause
```http
PUT /api/clauses/:id
Content-Type: application/json

{
  "content": "Updated content here"
}
```

#### Delete Clause
```http
DELETE /api/clauses/:id
```

### Templates

#### Get All Templates
```http
GET /api/templates
GET /api/templates?document_type=offer_letter
```

#### Get Template by ID
```http
GET /api/templates/:id
```

#### Create Template (Manual)
```http
POST /api/templates
Content-Type: application/json

{
  "template_name": "Standard Offer Letter",
  "document_type": "offer_letter",
  "description": "Standard template for job offers",
  "clause_ids": [1, 2, 3, 4, 5]
}
```

#### Save Template (After AI Generation)
```http
POST /api/templates/save-template
Content-Type: application/json

{
  "template_name": "AI Generated Offer Letter",
  "document_type": "offer_letter",
  "description": "AI-generated template",
  "clause_ids": [10, 11, 12, 13],
  "is_ai_generated": true
}
```

#### Add Clause to Template
```http
POST /api/templates/:id/add-clause
Content-Type: application/json

{
  "clause_id": 5,
  "position": 3
}
```

#### Delete Template
```http
DELETE /api/templates/:id
```

## 🔄 Workflow Example

### Automated Document Generation

```bash
# Step 1: Generate complete document with AI
curl -X POST http://localhost:5000/api/documents/generate-document \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "offer_letter",
    "document_name": "John_Doe_Offer_Letter",
    "context": {
      "company_name": "Tech Innovations Inc",
      "candidate_name": "John Doe",
      "position": "Senior Software Engineer",
      "salary": "$120,000 per year",
      "start_date": "February 1, 2026",
      "benefits": "Health insurance, 401(k), unlimited PTO"
    }
  }'
