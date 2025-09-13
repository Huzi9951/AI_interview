from django.contrib import admin
from .models import Movie, Review, Profile
@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    list_display = ('title','release_date')
@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('movie','user','rating','created_at')
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user',)
