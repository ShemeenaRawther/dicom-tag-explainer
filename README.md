# DICOM Tag Explainer

A web application that reads DICOM files and presents metadata in a readable format.

## Live Demo

🌐 **Live demo:** [https://shemeenarawther.github.io/dicom-tag-explainer/]

## Features

- Upload and analyze DICOM files
- Group DICOM tags by section
- Display tag code, name, VR, and value
- Expand nested sequences
- Identify private tags
- Hide Pixel Data from the metadata view
- Search tags by code, name, keyword, VR, or value
- Tag explanation panel for workflow and privacy context

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: ASP.NET Core Web API
- DICOM parsing: fo-dicom

## Run locally

### Backend

```bash
cd backend/DicomTagExplainer.Api
dotnet restore
dotnet run
