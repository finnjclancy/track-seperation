from supabase import create_client, Client
import os
from config import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_file(file_path: str, bucket_name: str, destination_path: str):
    """
    Uploads a file to Supabase Storage.
    """
    with open(file_path, 'rb') as f:
        try:
            response = supabase.storage.from_(bucket_name).upload(
                path=destination_path,
                file=f,
                file_options={"content-type": "audio/wav"}
            )
            return supabase.storage.from_(bucket_name).get_public_url(destination_path)
        except Exception as e:
            print(f"Upload Error: {e}")
            # If file exists, try to return the URL anyway or handle overwrite
            # simple fallback for now: get public url
            return supabase.storage.from_(bucket_name).get_public_url(destination_path)

def save_project(project_data: dict):
    """
    Saves project metadata to the database.
    """
    try:
        response = supabase.table("projects").insert(project_data).execute()
        return response
    except Exception as e:
        print(f"Database Error: {e}")
        raise e

