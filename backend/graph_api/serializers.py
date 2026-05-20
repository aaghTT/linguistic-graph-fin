from rest_framework import serializers

class ConceptSerializer(serializers.Serializer):
    id = serializers.IntegerField() 
    ru_name = serializers.CharField(max_length=500)
    en_name = serializers.CharField(max_length=500)
    type = serializers.CharField(max_length=50)  # object_concept, action_concept, object_attribute_concept, action_attribute_concept
    hypernym = serializers.IntegerField(allow_null=True, required=False)  # id родителя

class ConceptWithNeighborsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    ru_name = serializers.CharField()
    en_name = serializers.CharField()
    type = serializers.CharField()
    hypernym = serializers.IntegerField(allow_null=True)
    children = serializers.ListField(child=serializers.DictField())  # дочерние концепты
    semantic_neighbors = serializers.ListField(child=serializers.DictField())  # синонимы, антонимы и т.д.

class CreateEdgeSerializer(serializers.Serializer):
    from_id = serializers.IntegerField()
    to_id = serializers.IntegerField()
    rel_type = serializers.CharField()

class UpdateConceptSerializer(serializers.Serializer):
    new_ru_name = serializers.CharField(max_length=500, required=False)
    new_en_name = serializers.CharField(max_length=500, required=False)
    new_type = serializers.CharField(max_length=50, required=False)
    new_hypernym = serializers.IntegerField(allow_null=True, required=False)