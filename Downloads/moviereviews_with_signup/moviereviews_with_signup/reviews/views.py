from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from .models import Movie, Review, Profile
from .forms import ReviewForm, SignUpForm, MovieForm
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.views import LoginView



def index(request):
    return render(request, 'reviews/index.html')


def admin_login(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None and user.is_staff:
            login(request, user)
            return redirect('admin_panel')
        messages.error(request, 'Invalid admin credentials or not staff.')
    return redirect('index')

class CustomLoginView(LoginView):
    template_name = 'reviews/login.html'

@login_required
@user_passes_test(lambda u: u.is_staff)
def admin_panel(request):
    reviews = Review.objects.select_related('movie', 'user').order_by('-created_at')
    if request.method == 'POST':
        rid = request.POST.get('delete_review')
        if rid:
            try:
                r = Review.objects.get(pk=int(rid))
                r.delete()
                messages.success(request, 'Review deleted.')
                return redirect('admin_panel')
            except Review.DoesNotExist:
                messages.error(request, 'Review not found.')
    return render(request, 'reviews/admin_panel.html', {'reviews': reviews})


def movies_list(request):
    movies = Movie.objects.all().order_by('-release_date')
    return render(request, 'reviews/movie_list.html', {'movies': movies})


def movie_detail(request, pk):
    movie = get_object_or_404(Movie, pk=pk)
    reviews = movie.reviews.select_related('user').order_by('-created_at')
    if request.method == 'POST':
        if not request.user.is_authenticated:
            messages.error(request, 'Login required to post review.')
            return redirect('login')
        form = ReviewForm(request.POST)
        if form.is_valid():
            review = form.save(commit=False)
            review.movie = movie
            review.user = request.user
            review.save()
            messages.success(request, 'Review submitted.')
            return redirect('movie_detail', pk=pk)
    else:
        form = ReviewForm()
    return render(request, 'reviews/movie_detail.html', {
        'movie': movie,
        'reviews': reviews,
        'form': form
    })


def register_view(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save(commit=False)
            user.email = form.cleaned_data.get('email') or ''
            user.save()
            bio = form.cleaned_data.get('bio', '')
            avatar = form.cleaned_data.get('avatar', None)
            Profile.objects.create(user=user, bio=bio, avatar=avatar)
            messages.success(request, 'Account created. Please login.')
            return redirect('login')
    else:
        form = SignUpForm()
    return render(request, 'reviews/register.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('index')


# ✅ New: Any logged-in user can add a movie
@login_required
def add_movie(request):
    if request.method == 'POST':
        form = MovieForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Movie added successfully!")
            return redirect('movies_list')
    else:
        form = MovieForm()
    return render(request, 'reviews/add_movie.html', {'form': form})
