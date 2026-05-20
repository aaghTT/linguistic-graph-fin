
import requests
response = requests.post('http://localhost:8000/api/init-mock/')
print(response.json())
