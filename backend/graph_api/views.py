from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .memgraph_client import MemgraphClient
from .serializers import ConceptSerializer, CreateEdgeSerializer, UpdateConceptSerializer

client = MemgraphClient()

# ========== КОНЦЕПТЫ ==========

@api_view(['GET'])
def get_concept(request, concept_id):
    """GET /api/concept/1 - получить концепт со всеми связями"""
    result = client.get_concept_with_relations(concept_id)
    if result and result.get('id'):
        return Response(result)
    return Response({"error": "Concept not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_all_concepts(request):
    """GET /api/concepts - получить все концепты
       GET /api/concepts?type=object_concept - фильтр по типу"""
    concept_type = request.query_params.get('type')
    concepts = client.get_all_concepts(concept_type)
    return Response({"concepts": concepts})

@api_view(['POST'])
def add_concept(request):
    """POST /api/concept - создать концепт"""
    serializer = ConceptSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    success = client.add_concept(
        concept_id=data['id'],
        ru_name=data['ru_name'],
        en_name=data['en_name'],
        concept_type=data['type'],
        hypernym=data.get('hypernym')
    )
    
    if success:
        return Response({"status": "ok", "id": data['id']}, status=status.HTTP_201_CREATED)
    return Response({"error": "Failed to create concept"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['GET'])
def search_concepts(request):
    """GET /api/search/?q=сущность"""
    query = request.query_params.get('q', '')
    limit = int(request.query_params.get('limit', 50))
    
    if not query or len(query.strip()) < 2:
        return Response(
            {"error": "Search query must be at least 2 characters"},
            status=400
        )
    
    results = client.search_by_russian_word(query, limit)
    return Response({"query": query, "count": len(results), "results": results})

@api_view(['PUT'])
def update_concept(request, concept_id):
    """PUT /api/concept/1/update - обновить концепт"""
    serializer = UpdateConceptSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    client.update_concept(
        concept_id=concept_id,
        new_ru_name=data.get('new_ru_name'),
        new_en_name=data.get('new_en_name'),
        new_type=data.get('new_type'),
        new_hypernym=data.get('new_hypernym')
    )
    return Response({"status": "updated"})

@api_view(['DELETE'])
def delete_concept(request, concept_id):
    """DELETE /api/concept/1/delete - удалить концепт"""
    success = client.delete_concept(concept_id)
    if success:
        return Response({"status": "deleted", "id": concept_id})
    return Response({"error": "Concept not found"}, status=status.HTTP_404_NOT_FOUND)

# ========== ИЕРАРХИЯ (ДЕТИ И РОДИТЕЛИ) ==========

@api_view(['GET'])
def get_children(request, concept_id):
    """GET /api/concept/1/children - получить детей концепта"""
    children = client.get_children(concept_id)
    return Response({"concept_id": concept_id, "children": children})

@api_view(['GET'])
def get_parent(request, concept_id):
    """GET /api/concept/1/parent - получить родителя концепта"""
    parent = client.get_parent(concept_id)
    return Response({"concept_id": concept_id, "parent": parent})

@api_view(['GET'])
def get_children_recursive(request, concept_id):
    """GET /api/concept/1/children/all - получить всех потомков рекурсивно"""
    children = client.get_children_recursive(concept_id)
    return Response({"concept_id": concept_id, "descendants": children})

@api_view(['GET'])
def get_parents_recursive(request, concept_id):
    """GET /api/concept/1/parents/all - получить всех предков рекурсивно"""
    parents = client.get_parents_recursive(concept_id)
    return Response({"concept_id": concept_id, "ancestors": parents})

# ========== СЕМАНТИЧЕСКИЕ СВЯЗИ ==========

@api_view(['POST'])
def add_semantic_edge(request):
    """POST /api/semantic-edge - добавить семантическую связь
    Body: {"from": 1, "to": 2, "relation": "синоним"}"""
    serializer = CreateEdgeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    client.add_semantic_edge(data['from_id'], data['to_id'], data['rel_type'])
    return Response({"status": "ok"})

@api_view(['DELETE'])
def delete_semantic_edge(request):
    """DELETE /api/semantic-edge/delete - удалить семантическую связь
    Body: {"from": 1, "to": 2}"""
    from_id = request.data.get('from')
    to_id = request.data.get('to')
    relation = request.data.get('relation')
    
    if not from_id or not to_id:
        return Response({"error": "Missing 'from' or 'to'"}, status=status.HTTP_400_BAD_REQUEST)
    
    client.delete_semantic_edge(from_id, to_id, relation)
    return Response({"status": "deleted"})


@api_view(['POST'])
def load_concepts(request):
    """POST /api/load-concepts/ - загрузить концепты из JSON
    Body: [{"id": 1, "ru_name": "...", "en_name": "...", "type": "...", "hypernym": null}, ...]"""
    concepts_data = request.data
    if not isinstance(concepts_data, list):
        return Response({"error": "Expected list of concepts"}, status=status.HTTP_400_BAD_REQUEST)
    
    result = client.load_concepts_from_json(concepts_data)
    return Response(result)

# ========== ТЕСТОВЫЕ ДАННЫЕ ==========

@api_view(['POST'])
def load_test_data(request):
    """POST /api/load-test-data/ - загрузить тестовые данные для проверки"""
    result = client.load_test_data()
    return Response(result)